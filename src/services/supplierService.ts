import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import { calculateLOS, validateOccupancy, validateAvailability } from '../utils/helpers';

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

  async getPropertyInfo(propertyId: string) {
    try {
      const response = await this.client.get(`/properties/${propertyId}`);
      return this.mapPropertyInfo(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  async getRooms(propertyId: string, params: any) {
    const { check_in, check_out, adults, children = 0, infants = 0, currency = 'USD' } = params;
    
    try {
      const [roomsResponse, closedDatesResponse] = await Promise.all([
        this.client.get(`/properties/${propertyId}/rooms`, {
          params: { checkin_date: check_in, checkout_date: check_out }
        }),
        this.client.get(`/properties/${propertyId}/closed_dates`)
      ]);

      const rooms = roomsResponse.data.rooms || [];
      const closedDates = closedDatesResponse.data.closed_dates || [];
      
      return this.filterRooms(rooms, closedDates, {
        check_in, check_out, adults, children, infants, currency
      });
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        const timeoutError = new Error('Supplier timeout');
        (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }

  private mapPropertyInfo(data: any) {
    return {
      id: data.id,
      name: data.name || null,
      address: data.address || null,
      geo: data.coordinates ? {
        lat: data.coordinates.latitude,
        lng: data.coordinates.longitude
      } : null,
      facilities: data.facilities || [],
      photos: data.photos || [],
      hotel_policy: {
        currency: data.currency || 'USD',
        check_in: data.check_in_time || null,
        check_out: data.check_out_time || null
      }
    };
  }

  private filterRooms(rooms: Room[], closedDates: ClosedDate[], params: any) {
    const { check_in, check_out, adults, children, currency } = params;
    const los = calculateLOS(check_in, check_out);
    
    return rooms.filter(room => {
      // Exact occupancy matching
      if (!validateOccupancy(room.occupancy, adults, children)) {
        return false;
      }

      // Availability and restrictions
      if (!validateAvailability(room, closedDates, check_in, check_out, los)) {
        return false;
      }

      return true;
    }).map(room => ({
      id: room.id,
      type: room.type,
      price: {
        amount: Math.round(room.price * 100), // Always minor units
        currency: currency // Use X-Currency header
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

export const fetchPropertyInfo = (id: string, requestId: string) => 
  new SupplierService().getPropertyInfo(id);

export const fetchRooms = (id: string, checkIn: string, checkOut: string, requestId: string) => 
  new SupplierService().getRooms(id, { check_in: checkIn, check_out: checkOut });

export const fetchClosedDates = (id: string, requestId: string) => 
  Promise.resolve({ closed_dates: [] });