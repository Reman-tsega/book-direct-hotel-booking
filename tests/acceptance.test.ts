import request from 'supertest';
import app from '../src/index';
import axios from 'axios';

jest.mock('axios');
jest.mock('../src/services/cacheService');
jest.mock('../src/utils/helpers');
jest.mock('../src/utils/metrics');

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getPropertyCacheKey, getRoomsCacheKey, calculateLOS, generateIdemKey } = require('../src/utils/helpers');
    getPropertyCacheKey.mockReturnValue('cache-key');
    getRoomsCacheKey.mockReturnValue('rooms-cache-key');
    calculateLOS.mockReturnValue(2);
    generateIdemKey.mockReturnValue('idem-key');
  });

  afterAll(async () => {
    // Close any open handles
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Property Endpoint', () => {
    it('should return 200 for GET property', async () => {
      mockAxios.get.mockResolvedValue({ 
        data: { id: '123', title: 'Test Hotel', address: '123 Main St' } 
      });
      
      const res = await request(app)
        .get('/api/product/v2/hotels/123')
        .set('x-currency', 'USD');
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('123');
    });

    it('should return 502 for supplier error (no 404 handling in current implementation)', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      const error = new Error('Not found');
      mockAxios.get.mockRejectedValue(error);
      
      const res = await request(app).get('/api/product/v2/hotels/999');
      
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
    });
  });

  describe('Rooms Endpoint', () => {
    const validRoomsRequest = {
      check_in: '2024-12-25',
      check_out: '2024-12-27',
      adults: 2,
      children: 0
    };

    it('should return 200 with prices in minor units and X-Currency applied', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockResolvedValueOnce({ 
        data: { rooms: [{ 
          id: '101',
          occupancy: { adults: 2, children: 0 }, 
          price: 150,
          taxes: [{ type: 'city_tax', amount: 5.50 }]
        }] }
      }).mockResolvedValueOnce({ 
        data: { closed: [] }
      });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'test-key-123')
        .set('x-currency', 'EUR')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(200);
      expect(res.body.rooms[0].price.amount).toBe(15000); // 150 * 100
      expect(res.body.rooms[0].price.currency).toBe('EUR');
      expect(res.body.rooms[0].taxes[0].amount).toBe(550); // 5.50 * 100
    });

    it('should return 400 for missing idempotency key', async () => {
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });

    it('should return 400 for invalid date range', async () => {
      const { calculateLOS } = require('../src/utils/helpers');
      calculateLOS.mockReturnValue(-1); // Mock negative LOS for invalid range
      
      const invalidRequest = {
        check_in: '2024-12-27',
        check_out: '2024-12-25',
        adults: 2
      };
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'test-key-456')
        .send(invalidRequest);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('should return 400 for invalid adults count', async () => {
      const invalidRequest = {
        check_in: '2024-12-25',
        check_out: '2024-12-27',
        adults: 0
      };
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'test-key-789')
        .send(invalidRequest);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteRequest = {
        check_in: '2024-12-25'
      };
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'test-key-incomplete')
        .send(incompleteRequest);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Cache Scenarios', () => {
    it('should serve cached property data', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(JSON.stringify({ id: '123', title: 'Cached Hotel' }));
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Cached Hotel');
    });

    it('should handle cache miss and fetch from supplier', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockResolvedValue({ 
        data: { id: '123', title: 'Fresh Hotel' } 
      });
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Fresh Hotel');
    });
  });

  describe('Business Rules', () => {
    it('should filter rooms by exact occupancy matching', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockResolvedValueOnce({ 
        data: { rooms: [
          { id: '101', occupancy: { adults: 2, children: 0 }, price: 150, min_stay_arrival: 1 },
          { id: '102', occupancy: { adults: 3, children: 1 }, price: 200, min_stay_arrival: 1 }
        ]}
      }).mockResolvedValueOnce({ 
        data: { closed: [] }
      });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'occupancy-test')
        .send({ ...validRoomsRequest, adults: 3, children: 1 });
      
      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(1);
      expect(res.body.rooms[0].id).toBe('102');
    });

    it('should filter rooms by min_stay requirements', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      const { calculateLOS } = require('../src/utils/helpers');
      calculateLOS.mockReturnValue(1); // 1 night stay
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockResolvedValueOnce({ 
        data: { rooms: [{ 
          id: '101',
          occupancy: { adults: 2, children: 0 }, 
          price: 150,
          min_stay_arrival: 3 // Requires 3 nights minimum
        }]}
      }).mockResolvedValueOnce({ 
        data: { closed: [] }
      });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'minstay-test')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(0); // Filtered out due to min_stay
    });

    it('should filter rooms by closed_to_arrival dates', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockResolvedValueOnce({ 
        data: { rooms: [{ 
          id: '101',
          occupancy: { adults: 2, children: 0 }, 
          price: 150,
          min_stay_arrival: 1
        }]}
      }).mockResolvedValueOnce({ 
        data: { closed_to_arrival: ['2024-12-25'] }
      });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'closed-arrival-test')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(0); // Filtered out due to closed arrival
    });
  });

  describe('Stale Cache & Reliability', () => {
    it('should serve stale cache with Retry-After on supplier timeout', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      const staleData = { rooms: [{ id: 'stale-room', price: { amount: 10000, currency: 'USD' } }] };
      
      cacheGet.mockResolvedValueOnce(null) // Fresh cache miss
           .mockResolvedValueOnce(JSON.stringify(staleData)); // Stale cache hit
      
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'stale-test')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(200);
      expect(res.headers['retry-after']).toBe('60');
      expect(res.body).toEqual(staleData);
    });

    it('should return 502 when no stale cache available', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null); // No cache available
      
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'no-stale-test')
        .send(validRoomsRequest);
      
      expect(res.status).toBe(502);
      expect(res.headers['retry-after']).toBe('60');
      expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
    });
  });

  describe('Idempotency', () => {
    it('should return same response for duplicate idempotency keys', async () => {
      const { get: cacheGet, set: cacheSet } = require('../src/services/cacheService');
      const responseData = { rooms: [{ id: '101', price: { amount: 15000, currency: 'USD' } }] };
      
      cacheGet.mockResolvedValueOnce(null) // Fresh cache miss
           .mockResolvedValueOnce(JSON.stringify(responseData)); // Idempotency cache hit
      
      const res1 = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'duplicate-test')
        .send(validRoomsRequest);
      
      const res2 = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'duplicate-test')
        .send(validRoomsRequest);
      
      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger UI', async () => {
      const res = await request(app).get('/api-docs/');
      
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });
});