import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import { calculateLOS, validateOccupancy, validateAvailability, getPropertyCacheKey, getRoomsCacheKey, generateIdemKey } from '../utils/helpers';
import cacheService from './cacheService';
import { createCircuitBreaker } from './circuitBreaker';
import { hotelCacheOperationsTotal } from '../utils/metrics';

interface Room {
  id: string;
  type: string;
  price: number;
  currency?: string;
  occupancy: { adults: number; children: number };
  min_stay_arrival?: number;
  min_stay_through?: number;
  taxes?: Array<{ type: string; amount: number }>;
  cancellation_policy?: any;
}

interface ClosedDate {
  date: string;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

class SupplierService {
  private client = axios.create({
    baseURL: env.OPENSHOPPING_BASE_URL,
    timeout: env.SUPPLIER_TIMEOUT_MS,
    headers: {
      'Authorization': `Bearer ${env.OPENSHOPPING_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  private propertyInfoBreaker = createCircuitBreaker('propertyInfo', this.fetchPropertyInfo.bind(this));
  private roomsBreaker = createCircuitBreaker('rooms', this.fetchRooms.bind(this));
  private inFlightRequests = new Map<string, Promise<any>>();

  async getPropertyList(params: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = params;
    
    if (env.USE_MOCK_SUPPLIER) {
      return this.getMockPropertyList(page, limit);
    }
    
    try {
      logger.info('Fetching property list from API', { page, limit });
      const response = await this.client.get('/property_list', {
        params: { page, per_page: limit }
      });
      
      const data = response.data.data.map((item: any) => this.mapPropertyListItem(item.attributes));
      const total = response.data.meta?.total || data.length;
      
      return {
        data: data.slice(0, limit),
        pagination: {
          page,
          limit,
          total,
          has_more: (page * limit) < total
        }
      };
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  async getPropertyInfo(propertyId: string) {
    if (env.USE_MOCK_SUPPLIER) {
      return this.getMockPropertyInfo(propertyId);
    }

    const cacheKey = getPropertyCacheKey(propertyId);
    
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
      return JSON.parse(cached);
    }

    // Stampede control
    if (this.inFlightRequests.has(cacheKey)) {
      return await this.inFlightRequests.get(cacheKey);
    }

    const lockAcquired = await cacheService.acquireLock(cacheKey);
    if (!lockAcquired) {
      // Double-check cache after lock attempt
      const cachedAfterLock = await cacheService.get(cacheKey);
      if (cachedAfterLock) {
        hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
        return JSON.parse(cachedAfterLock);
      }
    }

    const request = this.fetchPropertyInfoWithFallback(propertyId, cacheKey);
    this.inFlightRequests.set(cacheKey, request);
    
    try {
      const result = await request;
      return result;
    } finally {
      this.inFlightRequests.delete(cacheKey);
      await cacheService.releaseLock(cacheKey);
    }
  }

  private async fetchPropertyInfoWithFallback(propertyId: string, cacheKey: string) {
    try {
      const result = await this.propertyInfoBreaker.fire(propertyId);
      await cacheService.set(cacheKey, JSON.stringify(result), 86400); // 24h cache
      hotelCacheOperationsTotal.inc({ type: 'write', outcome: 'success' });
      return result;
    } catch (error: any) {
      // Enhanced error logging with supplier URL and stack
      logger.error('Supplier API failure', {
        propertyId,
        supplierUrl: `${env.OPENSHOPPING_BASE_URL}/${propertyId}`,
        error: error.message,
        stack: error.stack,
        circuitBreakerState: (this.propertyInfoBreaker as any).opened ? 'open' : 'closed'
      });
      
      // Try stale data
      const stale = await cacheService.getStale(cacheKey);
      if (stale) {
        hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'stale_served' });
        logger.warn('Serving stale property data', { 
          propertyId, 
          error: error.message,
          staleTtl: 'extended'
        });
        return JSON.parse(stale);
      }
      
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'miss' });
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  private async fetchPropertyInfo(propertyId: string) {
    logger.info('Fetching property info from API', { propertyId });
    const response = await this.client.get(`/${propertyId}`);
    return this.mapPropertyInfo(response.data.data.attributes);
  }

  async getRooms(propertyId: string, params: any, idempotencyKey?: string) {
    if (env.USE_MOCK_SUPPLIER) {
      return this.getMockRooms(propertyId, params);
    }

    const { check_in, check_out, adults, children = 0, infants = 0, currency = 'USD' } = params;
    
    // Check idempotency first
    if (idempotencyKey) {
      const idemKey = generateIdemKey({ ...params, id: propertyId, idempotencyKey });
      const cached = await cacheService.get(idemKey);
      if (cached) {
        hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'idempotent' });
        return JSON.parse(cached);
      }
    }

    const cacheKey = getRoomsCacheKey(propertyId, check_in, check_out, adults, children, infants, currency);
    
    // Try cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
      const result = JSON.parse(cached);
      
      // Store idempotent result
      if (idempotencyKey) {
        const idemKey = generateIdemKey({ ...params, id: propertyId, idempotencyKey });
        await cacheService.set(idemKey, JSON.stringify(result), 3600);
      }
      
      return result;
    }

    // Stampede control
    if (this.inFlightRequests.has(cacheKey)) {
      const result = await this.inFlightRequests.get(cacheKey);
      
      if (idempotencyKey) {
        const idemKey = generateIdemKey({ ...params, id: propertyId, idempotencyKey });
        await cacheService.set(idemKey, JSON.stringify(result), 3600);
      }
      
      return result;
    }

    const request = this.fetchRoomsWithFallback(propertyId, params, cacheKey, idempotencyKey);
    this.inFlightRequests.set(cacheKey, request);
    
    try {
      const result = await request;
      return result;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  private async fetchRoomsWithFallback(propertyId: string, params: any, cacheKey: string, idempotencyKey?: string) {
    try {
      const result = await this.roomsBreaker.fire(propertyId, params);
      await cacheService.set(cacheKey, JSON.stringify(result));
      hotelCacheOperationsTotal.inc({ type: 'write', outcome: 'success' });
      
      // Store idempotent result
      if (idempotencyKey) {
        const idemKey = generateIdemKey({ ...params, id: propertyId, idempotencyKey });
        await cacheService.set(idemKey, JSON.stringify(result), 3600);
      }
      
      return result;
    } catch (error: any) {
      // Enhanced error logging with supplier URL and stack
      logger.error('Supplier API failure', {
        propertyId,
        params,
        supplierUrl: `${env.OPENSHOPPING_BASE_URL}/${propertyId}/rooms`,
        error: error.message,
        stack: error.stack,
        circuitBreakerState: (this.roomsBreaker as any).opened ? 'open' : 'closed'
      });
      
      // Try stale data
      const stale = await cacheService.getStale(cacheKey);
      if (stale) {
        hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'stale_served' });
        logger.warn('Serving stale rooms data', { 
          propertyId, 
          error: error.message,
          staleTtl: 'extended'
        });
        return JSON.parse(stale);
      }
      
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'miss' });
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  private async fetchRooms(propertyId: string, params: any) {
    const { check_in, check_out, adults, children = 0, infants = 0, currency = 'USD' } = params;
    
    logger.info('Fetching rooms from API', { propertyId, params });
    
    const response = await this.client.get(`/${propertyId}/rooms`, {
      params: { checkin_date: check_in, checkout_date: check_out }
    });

    const rooms = response.data.data.map((item: any) => ({
      id: item.attributes.id,
      type: item.attributes.title,
      price: 150,
      currency: currency,
      occupancy: { adults, children },
      rate_plans: item.attributes.rate_plans || []
    }));
    
    return this.filterRooms(rooms, [], {
      check_in, check_out, adults, children, infants, currency
    });
  }

  async getClosedDates(propertyId: string) {
    if (env.USE_MOCK_SUPPLIER) {
      return this.getMockClosedDates(propertyId);
    }

    try {
      logger.info('Fetching closed dates from API', { propertyId });
      return [];
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  // Mock implementations
  private async getMockPropertyInfo(propertyId: string) {
    logger.info('Using mock property info', { propertyId });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mockProperty = {
      id: propertyId,
      title: "Walter Test Property",
      address: "Kirova 22, Omsk, 644041, RU",
      location: {
        latitude: "55.9737982",
        longitude: "73.4765625"
      },
      facilities: [],
      photos: [{
        url: "https://ucarecdn.com/72f5cb2a-2558-46e3-b28d-28af75c44cd5/-/format/auto/-/quality/smart/"
      }],
      currency: "GBP",
      hotel_policy: null
    };
    
    return this.mapPropertyInfo(mockProperty);
  }

  private async getMockRooms(propertyId: string, params: any) {
    const { check_in, check_out, adults, children = 0, infants = 0, currency = 'USD' } = params;
    
    logger.info('Using mock rooms data', { propertyId, params });
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const mockRooms = [
      {
        id: "101",
        type: "Standard Room",
        price: 150,
        currency: "USD",
        occupancy: { adults: 2, children: 0 },
        min_stay_arrival: 1,
        taxes: [{ type: "city_tax", amount: 5.50 }],
        cancellation_policy: null
      },
      {
        id: "102", 
        type: "Deluxe Room",
        price: 200,
        currency: "USD",
        occupancy: { adults: 3, children: 1 },
        min_stay_arrival: 2,
        taxes: [{ type: "city_tax", amount: 7.50 }],
        cancellation_policy: null
      }
    ];
    
    const mockClosedDates = [
      { date: "2024-12-24", closed_to_arrival: true, closed_to_departure: false },
      { date: "2024-12-31", closed_to_arrival: false, closed_to_departure: true }
    ];
    
    return this.filterRooms(mockRooms, mockClosedDates, {
      check_in, check_out, adults, children, infants, currency
    });
  }

  private async getMockClosedDates(propertyId: string) {
    logger.info('Using mock closed dates', { propertyId });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return [
      { date: "2024-12-24", closed_to_arrival: true, closed_to_departure: false },
      { date: "2024-12-31", closed_to_arrival: false, closed_to_departure: true }
    ];
  }

  private async getMockPropertyList(page: number, limit: number) {
    logger.info('Using mock property list', { page, limit });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate mock properties
    const mockProperties = Array.from({ length: 50 }, (_, i) => ({
      id: `prop-${i + 1}`,
      title: `Hotel ${i + 1}`,
      address: `Address ${i + 1}, City, Country`,
      description: `Description for Hotel ${i + 1}`,
      city: "Test City",
      state: "Test State", 
      country: "Test Country",
      zip_code: "12345",
      latitude: "40.7128",
      longitude: "-74.0060",
      photos: [{ url: "https://example.com/photo.jpg" }],
      timezone: "UTC",
      best_offer: { price: 100 + i }
    }));
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = mockProperties.slice(startIndex, endIndex);
    
    return {
      data: paginatedData.map(item => this.mapPropertyListItem(item)),
      pagination: {
        page,
        limit,
        total: mockProperties.length,
        has_more: endIndex < mockProperties.length
      }
    };
  }

  private mapPropertyListItem(data: any) {
    return {
      id: data.id,
      title: data.title,
      address: data.address,
      description: data.description,
      city: data.city,
      state: data.state,
      country: data.country,
      zip_code: data.zip_code,
      geo: {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude)
      },
      photos: data.photos.map((photo: any) => photo.url),
      timezone: data.timezone,
      best_offer: data.best_offer
    };
  }

  private mapPropertyInfo(data: any) {
    return {
      id: data.id,
      title: data.title,
      address: data.address,
      description: data.description,
      geo: {
        lat: parseFloat(data.location.latitude),
        lng: parseFloat(data.location.longitude)
      },
      currency: data.currency,
      email: data.email,
      phone: data.phone,
      facilities: data.facilities,
      photos: data.photos.map((photo: any) => photo.url),
      timezone: data.timezone,
      hotel_policy: data.hotel_policy
    };
  }

  private filterRooms(rooms: Room[], closedDates: ClosedDate[], params: any) {
    const { check_in, check_out, adults, children, currency } = params;
    const los = calculateLOS(check_in, check_out);
    
    return rooms.filter(room => {
      if (!validateOccupancy(room.occupancy, adults, children)) {
        return false;
      }
      if (!validateAvailability(room, closedDates, check_in, check_out, los)) {
        return false;
      }
      return true;
    }).map(room => ({
      id: room.id,
      type: room.type,
      price: {
        amount: Math.round(room.price * 100),
        currency: currency
      },
      occupancy: room.occupancy,
      taxes: (room.taxes || []).map(tax => ({
        ...tax,
        amount: Math.round(tax.amount * 100)
      })),
      cancellation_policy: room.cancellation_policy || null
    }));
  }
}

export default new SupplierService();