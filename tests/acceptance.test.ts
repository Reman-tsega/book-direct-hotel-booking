import request from 'supertest';
import app from '../src/index';
import axios from 'axios';

jest.mock('axios');

describe('Acceptance Tests', () => {
  it('should return 200 for GET property', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { data: { attributes: { id: '123', title: 'Test Hotel' } } } });
    const res = await request(app).get('/api/product/v2/hotels/123');
    expect(res.status).toBe(200);
  });

  // Add tests for rooms, invalid inputs, cache hit, etc.
});