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
  async getPropertyInfo(propertyId: string) {
    try {
      // Mock data for testing - replace with real API call later
      logger.info('Fetching property info', { propertyId });
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const mockProperty = {
        id: propertyId,
        name: "Grand Hotel & Spa",
        address: "123 Main Street, New York, NY 10001",
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        facilities: ["WiFi", "Pool", "Gym", "Spa", "Restaurant"],
        photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
        currency: "USD",
        check_in_time: "15:00",
        check_out_time: "11:00"
      };
      
      return this.mapPropertyInfo(mockProperty);
    } catch (error: any) {
      logger.error('Supplier service error', { error: error.message, propertyId });
      const timeoutError = new Error('Supplier timeout');
      (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
      throw timeoutError;
    }
  }

  async getRooms(propertyId: string, params: any) {
    const { check_in, check_out, adults, children = 0, infants = 0, currency = 'USD' } = params;
    
    try {
      logger.info('Fetching rooms', { propertyId, params });
      
      // Simulate API delay
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
    } catch (error: any) {
      logger.error('Supplier service error', { error: error.message, propertyId });
      const timeoutError = new Error('Supplier timeout');
      (timeoutError as any).code = 'SUPPLIER_TIMEOUT';
      throw timeoutError;
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

// Legacy exports for compatibility
export const fetchPropertyInfo = (id: string, requestId: string) => 
  new SupplierService().getPropertyInfo(id);

export const fetchRooms = (id: string, checkIn: string, checkOut: string, requestId: string) => 
  new SupplierService().getRooms(id, { check_in: checkIn, check_out: checkOut });

export const fetchClosedDates = (id: string, requestId: string) => 
  Promise.resolve({ closed_dates: [] });