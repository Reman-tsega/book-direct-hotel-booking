import express from 'express';
import bodyParser from 'body-parser';
import { env } from './config/env';
import requestId from './middlewares/requestId';
import errorHandler from './middlewares/errorHandler';
import routes from './routes';
import { register } from './utils/metrics';
import logger from './utils/logger';

const app = express();

app.use(bodyParser.json());
app.use(requestId as any);

// Swagger UI
app.get('/swagger', (req, res) => {
  res.sendFile(__dirname + '/../swagger-ui.html');
});

// Simple API docs endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Book Direct API', version: '1.0.0' },
    paths: {
      '/api/product/v2/hotels/{id}': {
        get: {
          summary: 'Get property information',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'x-currency', in: 'header', schema: { type: 'string' } },
            { name: 'x-request-id', in: 'header', schema: { type: 'string' } }
          ]
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
          }
        }
      }
    }
  });
});

app.use(routes);

if (env.METRICS_ENABLED) {
  app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

app.use(errorHandler);

app.listen(env.PORT, () => logger.info(`Server running on port ${env.PORT}`));

export default app;