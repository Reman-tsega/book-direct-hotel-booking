// Test setup
process.env.NODE_ENV = 'test';
process.env.USE_MOCK_SUPPLIER = 'true';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error';
process.env.CACHE_TTL_SECONDS = '10';
process.env.SUPPLIER_TIMEOUT_MS = '1000';

// Mock Redis if not available
jest.setTimeout(10000);

beforeAll(async () => {
  // Wait a bit for app initialization
  await new Promise(resolve => setTimeout(resolve, 1000));
});

afterAll(async () => {
  // Clean up
  await new Promise(resolve => setTimeout(resolve, 500));
});