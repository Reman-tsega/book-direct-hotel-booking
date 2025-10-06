# Postman Test Collection

## Setup
1. Start Redis: `docker-compose up -d redis`
2. Start app: `npm run dev`
3. Base URL: `http://localhost:3000`

## Test Scenarios

### 1. Property List
```
GET http://localhost:3000/api/product/v2/hotels
Headers:
- x-request-id: test-001
- x-currency: USD

Query Params:
- page: 1
- limit: 10
```

### 2. Property Info
```
GET http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f
Headers:
- x-request-id: test-002
- x-currency: USD
```

### 3. Rooms Available
```
POST http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms
Headers:
- Content-Type: application/json
- idempotency-key: test-idem-001
- x-request-id: test-003
- x-currency: USD

Body:
{
  "check_in": "2024-12-25",
  "check_out": "2024-12-27",
  "adults": 2,
  "children": 0
}
```

### 4. Test Idempotency
Repeat request #3 with same `idempotency-key`
Expected: Same response, cached result

### 5. Invalid Date Range
```
POST http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms
Headers:
- Content-Type: application/json
- idempotency-key: test-error-001
- x-request-id: test-004

Body:
{
  "check_in": "2024-12-27",
  "check_out": "2024-12-25",
  "adults": 2
}
```
Expected: 400 Bad Request

### 6. Missing Idempotency Key
```
POST http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms
Headers:
- Content-Type: application/json
- x-request-id: test-005

Body:
{
  "check_in": "2024-12-25",
  "check_out": "2024-12-27",
  "adults": 2
}
```
Expected: 400 Bad Request

### 7. Metrics
```
GET http://localhost:3000/metrics
```
Expected: Prometheus metrics in text format

### 8. Direct Channex Test (if API key available)
```
GET http://localhost:3000/test/channex/property_info?propertyId=7299f84c-dd73-46ce-ae38-3d079de3927f
```

## Expected Behaviors

### Caching
- First request: Cache miss, data fetched from supplier
- Second request: Cache hit, faster response
- Check logs for cache outcomes

### Circuit Breaker
- After multiple failures, circuit opens
- Stale data served if available
- Circuit resets after timeout

### Observability
- All requests logged with structured JSON
- Metrics updated for each request
- Request IDs propagated through system

## Environment Variables for Testing
```
USE_MOCK_SUPPLIER=true  # Use mock data instead of real API
LOG_LEVEL=info          # See detailed logs
CACHE_TTL_SECONDS=60    # Short cache for testing
```