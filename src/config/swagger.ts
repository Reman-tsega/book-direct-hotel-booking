import { env } from './env';

export const specs = {
  openapi: '3.0.0',
  info: {
    title: 'Book Direct - Hotel Booking API',
    version: '2.0.0',
    description: 'A resilient hotel booking aggregation service with circuit breaker, caching, and comprehensive error handling'
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Development server'
    }
  ],
  paths: {
    '/api/product/v2/hotels/{id}': {
      get: {
        summary: 'Get property information',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'x-currency', in: 'header', schema: { type: 'string' } },
          { name: 'x-request-id', in: 'header', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Property information' },
          '404': { description: 'Property not found' },
          '502': { description: 'Supplier timeout' }
        }
      }
    },
    '/api/product/v2/hotels/{id}/get-rooms': {
      post: {
        summary: 'Get available rooms',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'idempotency-key', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'x-currency', in: 'header', schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['check_in', 'check_out', 'adults'],
                properties: {
                  check_in: { type: 'string', format: 'date' },
                  check_out: { type: 'string', format: 'date' },
                  adults: { type: 'integer', minimum: 1, maximum: 8 },
                  children: { type: 'integer', minimum: 0, maximum: 4 },
                  infants: { type: 'integer', minimum: 0, maximum: 2 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Available rooms' },
          '400': { description: 'Invalid request' },
          '502': { description: 'Supplier timeout' }
        }
      }
    }
  }
};