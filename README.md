# Book Direct - Hotel Booking Aggregation Service

A resilient hotel booking aggregation service that handles supplier API failures gracefully.

## Setup

### Prerequisites
- Node.js 18+
- Redis (via Docker)
- Git

### Installation
1. Clone repository: `git clone https://github.com/Reman-tsega/book-direct-hotel-booking.git`
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Start Redis: `docker-compose up -d`
5. Start application: `npm run dev`

### Environment Variables
```bash
# Supplier Configuration
OPENSHOPPING_BASE_URL=https://api.openshopping.com
OPENSHOPPING_API_KEY=your_api_key

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300
CACHE_JITTER_PERCENT=0.2

# Service Configuration
PORT=3000
SUPPLIER_TIMEOUT_MS=5000
LOG_LEVEL=info
METRICS_ENABLED=true
```

## API Documentation

Swagger UI: `http://localhost:3000/api-docs`

## API Endpoints

- `GET /api/product/v2/hotels/:id` - Get property information
- `POST /api/product/v2/hotels/:id/get-rooms` - Get available rooms
- `GET /metrics` - Prometheus metrics

### cURL Examples

**Get Property:**
```bash
curl -X GET "http://localhost:3000/api/product/v2/hotels/123" \
  -H "x-currency: USD" \
  -H "x-request-id: req-123"
```

**Get Rooms:**
```bash
curl -X POST "http://localhost:3000/api/product/v2/hotels/123/get-rooms" \
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

**Error Scenarios:**
```bash
# Invalid date range
curl -X POST "http://localhost:3000/api/product/v2/hotels/123/get-rooms" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-error" \
  -d '{"check_in": "2024-12-27", "check_out": "2024-12-25", "adults": 2}'

# Missing idempotency key
curl -X POST "http://localhost:3000/api/product/v2/hotels/123/get-rooms" \
  -H "Content-Type: application/json" \
  -d '{"check_in": "2024-12-25", "check_out": "2024-12-27", "adults": 2}'
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
├── utils/           # Shared utilities
└── types/           # TypeScript definitions
```

### Resilience Patterns
- **Circuit Breaker**: Opossum library with 50% error threshold
- **Caching**: Redis with jittered TTL (300s ± 20%)
- **Timeouts**: 5s supplier timeout with graceful degradation
- **Idempotency**: Request deduplication via idempotency-key
- **Stale-While-Revalidate**: Serve cached data during outages

### Observability
- **Logging**: Structured JSON logs with request tracing
- **Metrics**: Prometheus metrics for latency, errors, cache hits
- **Health**: Circuit breaker state monitoring
- **Tracing**: Request ID propagation

## Testing

- Acceptance tests: `npm run test:acceptance` 
- Reliability tests: `npm run test:reliability` 
- Load testing: `npm run test:load` (planned)

### Test Coverage
- **Acceptance Tests**: API endpoints, validation, cache scenarios, error handling
- **Reliability Tests**: Supplier timeouts, stale data serving, cache locks, Redis bypass, circuit breaker, idempotency

## Extensions & Trade-offs

### Current Omissions
- **Load Testing**: Omitted for MVP, planned for Week 2
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

**Week 1: Core Endpoints**
-  Property & rooms endpoints
-  Business rules implementation
-  Basic error handling
-  API documentation

**Week 2: Reliability & Observability**
-  Circuit breaker pattern
-  Caching with Redis
-  Prometheus metrics
-  Structured logging
-  Comprehensive test suite
-  Swagger API documentation
-  Load testing suite
-  Performance optimization

**Week 3: Production Features** (Planned)
-  Rate limiting
-  OpenTelemetry tracing
-  Multi-supplier support
-  Advanced caching strategies