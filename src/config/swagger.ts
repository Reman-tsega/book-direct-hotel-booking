import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Book Direct - Hotel Booking API',
      version: '1.0.0',
      description: 'A resilient hotel booking aggregation service that handles supplier API failures gracefully',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Property: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '123' },
            title: { type: 'string', example: 'Grand Hotel' },
            address: { type: 'string', example: '123 Main St, City' },
            geo: {
              type: 'object',
              properties: {
                lat: { type: 'number', example: 40.7128 },
                lng: { type: 'number', example: -74.0060 }
              }
            },
            facilities: { type: 'array', items: { type: 'string' } },
            photos: { type: 'array', items: { type: 'string' } },
            hotel_policy: {
              type: 'object',
              properties: {
                currency: { type: 'string', example: 'USD' },
                check_in: { type: 'string', example: '15:00' },
                check_out: { type: 'string', example: '11:00' }
              }
            }
          }
        },
        Room: {
          type: 'object',
          properties: {
            occupancy: {
              type: 'object',
              properties: {
                adults: { type: 'number', example: 2 },
                children: { type: 'number', example: 0 }
              }
            },
            price: { type: 'number', example: 15000 },
            currency: { type: 'string', example: 'USD' },
            taxes: { type: 'array', items: { type: 'object' } },
            cancellation_policy: { type: 'object' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'PROPERTY_NOT_FOUND' },
                message: { type: 'string', example: 'Property not found' }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'],
};

export const specs = swaggerJsdoc(options);