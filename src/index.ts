import express from 'express';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { specs } from './config/swagger';
import requestId from './middlewares/requestId';
import errorHandler from './middlewares/errorHandler';
import routes from './routes';
import { register } from './utils/metrics';
import logger from './utils/logger';

const app = express();

app.use(bodyParser.json());
app.use(requestId as any);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use(routes);

if (env.METRICS_ENABLED) {
  app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

app.use(errorHandler);

app.listen(env.PORT, () => logger.info(`Server running on port ${env.PORT}`));

export default app; // For testing