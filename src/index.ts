import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { specs } from './config/swagger';
import requestId from './middlewares/requestId';
import errorHandler from './middlewares/errorHandler';
import routes from './routes';
import { register } from './utils/metrics';
import logger from './utils/logger';
import cacheService from './services/cacheService';

const app = express();

app.use(express.json());
app.use(requestId as any);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API spec endpoint
app.get('/swagger.json', (req, res) => {
  res.json(specs);
});

app.use(routes);

if (env.METRICS_ENABLED) {
  app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await cacheService.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await cacheService.cleanup();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => logger.info(`Server running on port ${env.PORT}`));
}

export default app;