const request = require('supertest');
const app = require('../src/index');
const cacheService = require('../src/services/cacheService');

describe('Reliability Tests', () => {
  test('Supplier timeout serves stale cache with proper logging', async () => {
    // Pre-populate stale cache
    const staleData = [{ id: 'stale-room', type: 'Cached Room', price: { amount: 10000, currency: 'USD' } }];
    await cacheService.set('stale:rooms:timeout:2024-12-25:2024-12-27:A2-C0-I0:CUR=USD', staleData);
    
    const response = await request(app)
      .post('/api/product/v2/hotels/timeout/get-rooms')
      .set('Idempotency-Key', 'stale-test-1')
      .send({
        check_in: '2024-12-25',
        check_out: '2024-12-27',
        adults: 2
      });
    
    expect(response.headers['retry-after']).toBe('60');
    expect(response.body).toEqual(staleData);
  });

  test('No stale cache returns 502 with Retry-After', async () => {
    const response = await request(app)
      .post('/api/product/v2/hotels/timeout/get-rooms')
      .set('Idempotency-Key', 'no-stale-test')
      .send({
        check_in: '2024-12-26',
        check_out: '2024-12-28',
        adults: 2
      });
    
    expect(response.status).toBe(502);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.body.error.code).toBe('SUPPLIER_TIMEOUT');
  });

  test('Cache stampede protection with locks', async () => {
    const promises = Array(3).fill().map((_, i) => 
      request(app)
        .post('/api/product/v2/hotels/456/get-rooms')
        .set('Idempotency-Key', `stampede-${i}`)
        .send({
          check_in: '2024-12-25',
          check_out: '2024-12-27',
          adults: 2
        })
    );
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(0);
  });

  test('Idempotency key returns same response', async () => {
    const requestData = {
      check_in: '2024-12-25',
      check_out: '2024-12-27',
      adults: 2
    };

    const response1 = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('Idempotency-Key', 'idempotent-test')
      .send(requestData);

    const response2 = await request(app)
      .post('/api/product/v2/hotels/123/get-rooms')
      .set('Idempotency-Key', 'idempotent-test')
      .send(requestData);

    expect(response1.body).toEqual(response2.body);
  });
});