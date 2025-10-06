// Force mock mode for tests BEFORE any imports
process.env.USE_MOCK_SUPPLIER = 'true';
process.env.LOG_LEVEL = 'error';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { default: app } = require('../dist/index.js');

// Simple test without complex setup
describe('Basic API Tests', () => {
  
  beforeAll(() => {
    // Environment variables already set before imports
  });

  test('GET /metrics should return metrics', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
  });

  test('POST rooms should require idempotency key', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/test-id/get-rooms')
      .send({
        check_in: '2024-12-25',
        check_out: '2024-12-27',
        adults: 2
      });
    
    expect(response.status).toBe(400);
  });

  test('GET property should use mock data', async () => {
    const response = await request(app)
      .get('/api/product/v2/hotels/test-id')
      .set('x-request-id', 'test-001');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
  });
});