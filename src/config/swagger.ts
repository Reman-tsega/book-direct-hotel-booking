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
  components: {
    schemas: {
      Property: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '7299f84c-dd73-46ce-ae38-3d079de3927f' },
          title: { type: 'string', example: 'Walter Test Property' },
          address: { type: 'string', example: 'Kirova 22, Omsk, 644041, RU' },
          description: { type: 'string', example: 'Good Hotel!' },
          geo: {
            type: 'object',
            properties: {
              lat: { type: 'number', example: 55.9737982 },
              lng: { type: 'number', example: 73.4765625 }
            }
          },
          currency: { type: 'string', example: 'GBP' },
          email: { type: 'string', example: 'waltereevan@gmail.com' },
          phone: { type: 'string', example: '5557575' },
          facilities: { type: 'array', items: { type: 'string' } },
          photos: { type: 'array', items: { type: 'string' } },
          timezone: { type: 'string', example: 'Asia/Omsk' },
          hotel_policy: { type: 'object', nullable: true }
        }
      },
      Room: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '101' },
          type: { type: 'string', example: 'Standard Room' },
          price: {
            type: 'object',
            properties: {
              amount: { type: 'integer', example: 15000 },
              currency: { type: 'string', example: 'USD' }
            }
          },
          occupancy: {
            type: 'object',
            properties: {
              adults: { type: 'integer', example: 2 },
              children: { type: 'integer', example: 0 }
            }
          },
          taxes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'city_tax' },
                amount: { type: 'integer', example: 550 }
              }
            }
          },
          cancellation_policy: { type: 'object', nullable: true }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_DATE_RANGE' },
              message: { type: 'string', example: 'Check-out must be after check-in' },
              details: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'check_out' },
                  reason: { type: 'string', example: 'Invalid date range' }
                }
              }
            }
          }
        }
      }
    }
  },
  paths: {
    '/api/product/v2/hotels': {
      get: {
        summary: 'Get property list with pagination',
        tags: ['Properties'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'x-request-id', in: 'header', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Property list with pagination',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Property' } },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        has_more: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          },
          '502': { $ref: '#/components/responses/SupplierTimeout' }
        }
      }
    },
    '/api/product/v2/hotels/{id}': {
      get: {
        summary: 'Get property information',
        tags: ['Properties'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: '7299f84c-dd73-46ce-ae38-3d079de3927f' },
          { name: 'x-currency', in: 'header', schema: { type: 'string', default: 'USD' } },
          { name: 'x-request-id', in: 'header', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Property information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '502': { $ref: '#/components/responses/SupplierTimeout' }
        }
      }
    },
    '/api/product/v2/hotels/{id}/get-rooms': {
      post: {
        summary: 'Get available rooms',
        tags: ['Rooms'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: '7299f84c-dd73-46ce-ae38-3d079de3927f' },
          { name: 'idempotency-key', in: 'header', required: true, schema: { type: 'string' }, example: 'unique-key-123' },
          { name: 'x-currency', in: 'header', schema: { type: 'string', default: 'USD' } },
          { name: 'x-request-id', in: 'header', schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['check_in', 'check_out', 'adults'],
                properties: {
                  check_in: { type: 'string', format: 'date', example: '2024-12-25' },
                  check_out: { type: 'string', format: 'date', example: '2024-12-27' },
                  adults: { type: 'integer', minimum: 1, maximum: 8, example: 2 },
                  children: { type: 'integer', minimum: 0, maximum: 4, example: 0 },
                  infants: { type: 'integer', minimum: 0, maximum: 2, example: 0 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Available rooms',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Room' }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '502': { $ref: '#/components/responses/SupplierTimeout' }
        }
      }
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        tags: ['Monitoring'],
        responses: {
          '200': {
            description: 'Prometheus metrics in text format',
            content: {
              'text/plain': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      SupplierTimeout: {
        description: 'Supplier Timeout',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    }
};