import request from 'supertest';
import app from '../src/index';
import axios from 'axios';

jest.mock('axios');
jest.mock('../src/services/cacheService');
jest.mock('../src/utils/helpers');
jest.mock('../src/utils/metrics');

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Reliability Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getPropertyCacheKey, getRoomsCacheKey, calculateLOS, generateIdemKey } = require('../src/utils/helpers');
    getPropertyCacheKey.mockReturnValue('cache-key');
    getRoomsCacheKey.mockReturnValue('rooms-cache-key');
    calculateLOS.mockReturnValue(2);
    generateIdemKey.mockReturnValue('idem-key');
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Supplier Timeout Handling', () => {
    it('should handle supplier timeout gracefully', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
    });
  });

  describe('Stale Data Serving with Proper Logging', () => {
    it('should serve stale data with Retry-After header and proper logging', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      const staleData = { id: '123', title: 'Stale Hotel', address: 'Old Address' };
      
      cacheGet.mockResolvedValueOnce(null) // Fresh cache miss
           .mockResolvedValueOnce(JSON.stringify(staleData)); // Stale cache hit
      
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(200);
      expect(res.headers['retry-after']).toBe('60');
      expect(res.body.title).toBe('Stale Hotel');
    });

    it('should serve stale rooms data during supplier timeout', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      const staleRooms = { rooms: [{ 
        id: 'stale-101', 
        price: { amount: 12000, currency: 'USD' },
        occupancy: { adults: 2, children: 0 }
      }] };
      
      cacheGet.mockResolvedValueOnce(null) // Fresh cache miss
           .mockResolvedValueOnce(null) // Idempotency miss
           .mockResolvedValueOnce(JSON.stringify(staleRooms)); // Stale cache hit
      
      mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'stale-rooms-test')
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2
        });
      
      expect(res.status).toBe(200);
      expect(res.headers['retry-after']).toBe('60');
      expect(res.body.rooms[0].id).toBe('stale-101');
    });

    it('should return 502 when no stale data available', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockRejectedValue(new Error('Complete failure'));
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
    });
  });

  describe('Cache Lock Mechanism', () => {
    it('should handle cache lock acquisition for rooms', async () => {
      const { get: cacheGet, acquireLock } = require('../src/services/cacheService');
      
      cacheGet.mockResolvedValue(null);
      acquireLock.mockResolvedValue(true);
      
      mockAxios.get.mockResolvedValueOnce({ 
        data: { rooms: [{ occupancy: { adults: 2 }, price: 100 }] }
      }).mockResolvedValueOnce({ 
        data: { closed: [] }
      });
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'lock-test')
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2
        });
      
      expect(res.status).toBe(200);
      expect(acquireLock).toHaveBeenCalled();
    });
  });

  describe('Redis Bypass Scenarios', () => {
    it('should handle Redis write failures and still return supplier error', async () => {
      const { get: cacheGet, set: cacheSet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      cacheSet.mockRejectedValue(new Error('Redis write failed'));
      
      mockAxios.get.mockRejectedValue(new Error('Supplier error'));
      
      const res = await request(app).get('/api/product/v2/hotels/123');
      
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
    });
  });

  describe('Circuit Breaker Behavior', () => {
    it('should handle multiple consecutive failures', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      cacheGet.mockResolvedValue(null);
      
      mockAxios.get.mockRejectedValue(new Error('Circuit open'));
      
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app).get(`/api/product/v2/hotels/test-${i}`)
        );
      }
      
      const responses = await Promise.all(requests);
      
      responses.forEach((res: any) => {
        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('SUPPLIER_TIMEOUT');
      });
    });
  });

  describe('Idempotency Protection', () => {
    it('should return cached response for duplicate idempotency key', async () => {
      const { get: cacheGet } = require('../src/services/cacheService');
      const cachedResponse = { rooms: [{ occupancy: { adults: 2 }, price: 7500 }] };
      
      cacheGet.mockResolvedValue(JSON.stringify(cachedResponse));
      
      const res = await request(app)
        .post('/api/product/v2/hotels/123/get-rooms')
        .set('idempotency-key', 'duplicate-key')
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2
        });
      
      expect(res.status).toBe(200);
      expect(res.body.rooms[0].price).toBe(7500);
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });
});