const request = require('supertest');
const app = require('../src/index');

describe('Acceptance Tests', () => {
  test('GET property returns 200', async () => {
    const response = await request(app)
      .get('/api/product/v2/hotels/123')
      .set('X-Request-Id', 'test-req-1');
    
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('test-req-1');
  });

  test('POST rooms with valid data returns 200 with prices in minor units', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('X-Request-Id', 'test-req-2')
      .set('X-Currency', 'EUR')
      .set('Idempotency-Key', 'test-key-1')
      .send({
        check_in: '2024-12-25',
        check_out: '2024-12-27',
        adults: 2,
        children: 0
      });
    
    expect(response.status).toBe(200);
    expect(response.body[0].price.amount).toBe(15000); // 150 * 100
    expect(response.body[0].price.currency).toBe('EUR');
    expect(response.body[0].taxes[0].amount).toBe(550); // 5.50 * 100
  });

  test('POST rooms filtered by min_stay requirement', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('Idempotency-Key', 'test-key-minstay')
      .send({
        check_in: '2024-12-25',
        check_out: '2024-12-26', // 1 night, but min_stay is 3
        adults: 2,
        children: 0
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]); // No rooms due to min_stay
  });

  test('POST rooms blocked by closed_to_arrival', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('Idempotency-Key', 'test-key-closed')
      .send({
        check_in: '2024-12-24', // Closed to arrival
        check_out: '2024-12-26',
        adults: 2,
        children: 0
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST rooms filtered by exact occupancy', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('Idempotency-Key', 'test-key-occupancy')
      .send({
        check_in: '2024-12-25',
        check_out: '2024-12-28', // 3 nights
        adults: 3,
        children: 1 // Matches room 102 only
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('102');
  });
});