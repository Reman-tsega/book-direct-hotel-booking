import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  OPENSHOPPING_BASE_URL: process.env.OPENSHOPPING_BASE_URL || '',
  OPENSHOPPING_API_KEY: process.env.OPENSHOPPING_API_KEY || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  PORT: parseInt(process.env.PORT || '3000'),
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
  CACHE_JITTER_PERCENT: parseFloat(process.env.CACHE_JITTER_PERCENT || '0.2'),
  SUPPLIER_TIMEOUT_MS: parseInt(process.env.SUPPLIER_TIMEOUT_MS || '5000'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
};