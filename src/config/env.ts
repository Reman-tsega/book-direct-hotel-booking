import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000'),
  OPENSHOPPING_BASE_URL: process.env.OPENSHOPPING_BASE_URL || 'http://localhost:8080',
  OPENSHOPPING_API_KEY: process.env.OPENSHOPPING_API_KEY || 'test-key',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
  CACHE_JITTER_PERCENT: parseInt(process.env.CACHE_JITTER_PERCENT || '20'),
  SUPPLIER_TIMEOUT_MS: parseInt(process.env.SUPPLIER_TIMEOUT_MS || '5000'),
  RATE_LIMIT_RPM: parseInt(process.env.RATE_LIMIT_RPM || '60'),
  METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
  USE_MOCK_SUPPLIER: process.env.USE_MOCK_SUPPLIER === 'false'
};