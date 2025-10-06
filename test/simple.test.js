const request = require('supertest');

// Simple test without complex setup
describe('Basic API Tests', () => {
  let app;
  
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.USE_MOCK_SUPPLIER = 'true';
    process.env.LOG_LEVEL = 'error';
    
    // Import app after setting env vars
    const { default: importedApp } = require('../dist/index.js');
    app = importedApp;
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