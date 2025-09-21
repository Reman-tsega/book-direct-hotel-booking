import * as winston from 'winston';
import { env } from '../config/env';

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export default logger;