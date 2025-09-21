import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Book Direct - Hotel Booking API',
      version: '2.0.0',
      description: 'A resilient hotel booking aggregation service with circuit breaker, caching, and comprehensive error handling',
      contact: {
        name: 'API Support',
        url: 'https://github.com/Reman-tsega/book-direct-hotel-booking',
        email: 'support@bookdirect.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
      {
        url: 'https://api.bookdirect.com',
        description: 'Production server'
      }
    ],
    components: {
      parameters: {
        PropertyId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Unique property identifier',
          example: '123'
        },
        Currency: {
          name: 'x-currency',
          in: 'header',
          schema: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY'] },
          description: 'Currency code for pricing',
          example: 'USD'
        },
        RequestId: {
          name: 'x-request-id',
          in: 'header',
          schema: { type: 'string' },
          description: 'Unique request identifier for tracing',
          example: 'req-123-456'
        },
        IdempotencyKey: {
          name: 'idempotency-key',
          in: 'header',
          required: true,
          schema: { type: 'string' },
          description: 'Unique key to prevent duplicate requests',
          example: 'unique-key-123'
        }
      },
      schemas: {
        Property: {
          type: 'object',
          required: ['id', 'title'],
          properties: {
            id: { type: 'string', description: 'Property unique identifier', example: '123' },
            title: { type: 'string', description: 'Property name', example: 'Grand Hotel & Spa' },
            address: { type: 'string', description: 'Property address', example: '123 Main St, New York, NY 10001' },
            geo: {
              type: 'object',
              description: 'Geographic coordinates',
              properties: {
                lat: { type: 'number', format: 'float', description: 'Latitude', example: 40.7128 },
                lng: { type: 'number', format: 'float', description: 'Longitude', example: -74.0060 }
              }
            },
            facilities: {
              type: 'array',
              description: 'Available facilities',
              items: { type: 'string' },
              example: ['WiFi', 'Pool', 'Gym', 'Spa', 'Restaurant']
            },
            photos: {
              type: 'array',
              description: 'Property photos URLs',
              items: { type: 'string', format: 'uri' },
              example: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']
            },
            hotel_policy: {
              type: 'object',
              description: 'Hotel policies and information',
              properties: {
                currency: { type: 'string', description: 'Default currency', example: 'USD' },
                check_in: { type: 'string', description: 'Check-in time', example: '15:00' },
                check_out: { type: 'string', description: 'Check-out time', example: '11:00' }
              }
            }
          }
        },
        RoomsRequest: {
          type: 'object',
          required: ['check_in', 'check_out', 'adults'],
          properties: {
            check_in: {
              type: 'string',
              format: 'date',
              description: 'Check-in date in YYYY-MM-DD format (UTC)',
              example: '2024-12-25'
            },
            check_out: {
              type: 'string',
              format: 'date',
              description: 'Check-out date in YYYY-MM-DD format (UTC)',
              example: '2024-12-27'
            },
            adults: {
              type: 'integer',
              minimum: 1,
              maximum: 8,
              description: 'Number of adults',
              example: 2
            },
            children: {
              type: 'integer',
              minimum: 0,
              maximum: 4,
              description: 'Number of children',
              example: 0,
              default: 0
            },
            infants: {
              type: 'integer',
              minimum: 0,
              maximum: 2,
              description: 'Number of infants',
              example: 0,
              default: 0
            }
          }
        },
        Room: {
          type: 'object',
          properties: {
            occupancy: {
              type: 'object',
              description: 'Room occupancy details',
              properties: {
                adults: { type: 'integer', description: 'Number of adults', example: 2 },
                children: { type: 'integer', description: 'Number of children', example: 0 }
              }
            },
            price: {
              type: 'integer',
              description: 'Price in cents (multiply by 100)',
              example: 15000
            },
            currency: {
              type: 'string',
              description: 'Currency code',
              example: 'USD'
            },
            taxes: {
              type: 'array',
              description: 'Tax breakdown',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'VAT' },
                  amount: { type: 'integer', example: 1500 }
                }
              }
            },
            cancellation_policy: {
              type: 'object',
              description: 'Cancellation policy details',
              properties: {
                free_cancellation_until: { type: 'string', format: 'date-time' },
                penalty_amount: { type: 'integer' }
              }
            },
            min_stay_arrival: {
              type: 'integer',
              description: 'Minimum stay requirement for arrival date',
              example: 2
            },
            min_stay_through: {
              type: 'integer',
              description: 'Minimum stay requirement through period',
              example: 1
            }
          }
        },
        RoomsResponse: {
          type: 'object',
          properties: {
            rooms: {
              type: 'array',
              description: 'Available rooms matching criteria',
              items: { $ref: '#/components/schemas/Room' }
            }
          }
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'PROPERTY_NOT_FOUND',
                    'SUPPLIER_TIMEOUT',
                    'VALIDATION_ERROR',
                    'MISSING_IDEMPOTENCY_KEY',
                    'INVALID_DATE_RANGE',
                    'INTERNAL_ERROR'
                  ],
                  description: 'Error code',
                  example: 'PROPERTY_NOT_FOUND'
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                  example: 'Property not found'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                  additionalProperties: true
                }
              }
            },
            request_id: {
              type: 'string',
              description: 'Request ID for debugging',
              example: 'req-123-456'
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string', example: '2.0.0' },
            uptime: { type: 'number', example: 3600 }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad Request - Invalid input parameters',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              examples: {
                validation_error: {
                  summary: 'Validation Error',
                  value: {
                    error: {
                      code: 'VALIDATION_ERROR',
                      message: 'Invalid adults count'
                    }
                  }
                },
                missing_idempotency: {
                  summary: 'Missing Idempotency Key',
                  value: {
                    error: {
                      code: 'MISSING_IDEMPOTENCY_KEY',
                      message: 'Idempotency-Key required'
                    }
                  }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Not Found - Resource does not exist',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'PROPERTY_NOT_FOUND',
                  message: 'Property not found'
                }
              }
            }
          }
        },
        ServiceUnavailable: {
          description: 'Service Unavailable - Supplier timeout or circuit breaker open',
          headers: {
            'Retry-After': {
              description: 'Seconds to wait before retrying',
              schema: { type: 'integer', example: 60 }
            }
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  code: 'SUPPLIER_TIMEOUT',
                  message: 'Supplier timeout'
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Hotels',
        description: 'Hotel property and room operations'
      },
      {
        name: 'Monitoring',
        description: 'Health checks and metrics'
      }
    ]
  },
  apis: ['./src/routes/*.ts'],
};

export const specs = swaggerJsdoc(options);