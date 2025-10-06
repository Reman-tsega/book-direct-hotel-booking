const request = require('supertest');
const { default: app } = require('../dist/index.js');

describe('Hotel Booking API - Acceptance Tests', () => {
  
  describe('Property Info Endpoint', () => {
    test('GET /api/product/v2/hotels/:id should return property details', async () => {
      const response = await request(app)
        .get('/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f')
        .set('x-currency', 'USD')
        .set('x-request-id', 'test-001');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('geo');
    });
  });

  describe('Rooms Endpoint', () => {
    test('POST /api/product/v2/hotels/:id/get-rooms should return available rooms', async () => {
      const response = await request(app)
        .post('/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms')
        .set('Content-Type', 'application/json')
        .set('idempotency-key', 'test-idem-001')
        .set('x-currency', 'USD')
        .set('x-request-id', 'test-002')
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2,
          children: 0
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Should reject invalid date range', async () => {
      const response = await request(app)
        .post('/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms')
        .set('Content-Type', 'application/json')
        .set('idempotency-key', 'test-error-001')
        .send({
          check_in: '2024-12-27',
          check_out: '2024-12-25',
          adults: 2
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    test('Should require idempotency key', async () => {
      const response = await request(app)
        .post('/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms')
        .set('Content-Type', 'application/json')
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    });
  });

  describe('Metrics Endpoint', () => {
    test('GET /metrics should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });
});

