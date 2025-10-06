# Book Direct - Hotel Booking Aggregation Service

A resilient hotel booking aggregation service with circuit breaker, Redis caching, and graceful supplier API failure handling.

## Quick Start

### Prerequisites
- Node.js 18+
- Redis (via Docker)
- Git

### Installation
1. Clone repository: `git clone https://github.com/Reman-tsega/book-direct-hotel-booking.git`
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Start Redis: `docker-compose up -d`
5. Build application: `npm run build`
6. Start application: `npm run dev`

### Environment Configuration
```bash
# Supplier API Configuration
OPENSHOPPING_BASE_URL=https://staging.channex.io/api/v1/meta/OpenShopping
OPENSHOPPING_API_KEY=your_api_key

# Mock Mode (Development/Testing)
USE_MOCK_SUPPLIER=true  # Set to false for real API

# Redis Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300
CACHE_JITTER_PERCENT=20

# Service Configuration
PORT=3000
SUPPLIER_TIMEOUT_MS=5000
LOG_LEVEL=info
METRICS_ENABLED=true
RATE_LIMIT_RPM=60
```

### Mock vs Real API Mode

**Mock Mode (Recommended for Development):**
```bash
USE_MOCK_SUPPLIER=true
```
- Returns test data instantly
- No external API dependency
- Perfect for development and testing

**Real API Mode:**
```bash
USE_MOCK_SUPPLIER=false
OPENSHOPPING_API_KEY=your_actual_api_key
```
- Connects to Channex OpenShopping API
- Requires valid API key
- Subject to external API availability

## API Documentation

Swagger UI: `http://localhost:3000/api-docs`

## API Endpoints

- `GET /api/product/v2/hotels/:id` - Get property information
- `POST /api/product/v2/hotels/:id/get-rooms` - Get available rooms
- `GET /metrics` - Prometheus metrics

### cURL Examples

**Get Property Information:**
```bash
curl -X GET "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f" \
  -H "x-currency: USD" \
  -H "x-request-id: req-123"
```

**Get Available Rooms:**
```bash
curl -X POST "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: unique-key-123" \
  -H "x-currency: USD" \
  -H "x-request-id: req-456" \
  -d '{
    "check_in": "2024-12-25",
    "check_out": "2024-12-27",
    "adults": 2,
    "children": 0
  }'
```

**Get Metrics:**
```bash
curl -X GET "http://localhost:3000/metrics"
```

**Error Scenarios:**
```bash
# Invalid date range
curl -X POST "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-error" \
  -d '{"check_in": "2024-12-27", "check_out": "2024-12-25", "adults": 2}'

# Missing idempotency key
curl -X POST "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms" \
  -H "Content-Type: application/json" \
  -d '{"check_in": "2024-12-25", "check_out": "2024-12-27", "adults": 2}'
```

### External API Endpoints (Real Mode)

When `USE_MOCK_SUPPLIER=false`, the service calls:

**Property Info:**
```bash
GET https://staging.channex.io/api/v1/meta/OpenShopping/{propertyId}
```

**Rooms:**
```bash
GET https://staging.channex.io/api/v1/meta/OpenShopping/{propertyId}/rooms?checkin_date={check_in}&checkout_date={check_out}
```

## Business Rules Summary

### Date Handling
- All dates in UTC format (YYYY-MM-DD)
- Check-in must be before check-out
- Minimum 1 night stay
- Maximum 30 days advance booking

### Occupancy Rules
- Exact occupancy matching (adults + children)
- Adults: minimum 1, maximum 8
- Children: minimum 0, maximum 4
- Infants: minimum 0, maximum 2

### Availability Restrictions
- Closed dates excluded
- Arrival/departure restrictions applied
- Minimum stay requirements enforced
- Rate availability validated

### Pricing
- Prices in cents (multiply by 100)
- Currency conversion via x-currency header
- Taxes included separately
- Cancellation policies attached

## Architecture

### Modular Design
```
src/
├── config/          # Environment & Swagger config
├── controllers/     # Request handlers
├── middlewares/     # Request processing
├── routes/          # API route definitions
├── services/        # Business logic
│   ├── supplierService.ts    # External API integration
│   ├── cacheService.ts       # Redis cache operations
│   └── circuitBreaker.ts     # Circuit breaker implementation
├── utils/           # Shared utilities
└── types/           # TypeScript definitions
```

### Resilience Implementation

#### Circuit Breaker (Opossum)
- **Error Threshold**: 50% failure rate triggers open state
- **Reset Timeout**: 5 seconds (configurable)
- **Timeout**: 5 seconds per request
- **Monitoring**: Real-time state tracking via metrics

```typescript
const options = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 5000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10
};
```

#### Redis Caching & Locking
- **TTL**: 300 seconds with 20% jitter
- **Stale-While-Revalidate**: Serves stale data during outages
- **Cache Stampede Protection**: Distributed locks prevent duplicate requests
- **Idempotency**: Request deduplication via idempotency-key

**Cache Keys:**
- Property: `property:{propertyId}`
- Rooms: `rooms:{propertyId}:{checkIn}:{checkOut}:{adults}:{children}:{currency}`
- Locks: `lock:{cacheKey}`
- Idempotency: `idem:{hash}`

#### Redis Setup
```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:alpine

# Or with docker-compose
docker-compose up -d
```

### Observability
- **Logging**: Structured JSON logs with request tracing
- **Metrics**: Prometheus metrics for latency, errors, cache hits
- **Circuit Breaker**: State monitoring (open/closed/half-open)
- **Cache Operations**: Hit/miss/stale ratios

## Testing

```bash
# Run all tests
npm test

# Build and test
npm run build && npm test

# Test with coverage
npm run test:coverage
```

### Test Coverage
- **Acceptance Tests**: API endpoints, validation, error handling
- **Mock Integration**: Tests run with `USE_MOCK_SUPPLIER=true`
- **Circuit Breaker**: Failure scenarios and recovery
- **Cache Operations**: Hit/miss scenarios, idempotency
- **Business Rules**: Date validation, occupancy rules

## Extensions & Trade-offs

### Current Omissions
- **Load Testing**: Omitted for MVP, planned for phase 2
- **Multi-Region**: Single region deployment
- **Advanced Caching**: No cache warming or preloading

### Next Phase Features
- **FX Normalization**: Real-time currency conversion
- **Multi-Supplier**: Parallel supplier aggregation
- **Advanced Filtering**: Price ranges, amenities
- **Inventory Management**: Real-time availability updates

### Production Readiness
- **Rate Limiting**: Request throttling per client
- **OpenTelemetry**: Distributed tracing
- **Security**: API authentication & authorization
- **Monitoring**: APM integration (DataDog/New Relic)
- **Deployment**: Kubernetes manifests

### Development Phases

**phase 1: Core Endpoints**
-  Property & rooms endpoints
-  Business rules implementation
-  Basic error handling
-  API documentation

**phase 2: Reliability & Observability**
-  Circuit breaker pattern
-  Caching with Redis
-  Prometheus metrics
-  Structured logging
-  Comprehensive test suite
-  Swagger API documentation
-  Load testing suite
-  Performance optimization
