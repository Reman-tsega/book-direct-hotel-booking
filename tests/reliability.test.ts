import request from 'supertest';
import app from '../src/index';
import axios from 'axios';

jest.mock('axios');

describe('Reliability Tests', () => {
  it('should handle supplier timeout', async () => {
    (axios.get as jest.Mock).mockRejectedValue({ code: 'ECONNABORTED' });
    const res = await request(app).get('/api/product/v2/hotels/123');
    expect([200, 502]).toContain(res.status); // 200 if stale
  });

  // Add tests for stale serve, lock, Redis bypass
});