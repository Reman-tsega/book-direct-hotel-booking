# Implementation Assumptions

## API Response Mapping

### Property Info
- Missing fields are mapped to `null` explicitly
- `location` object is flattened to `geo.lat` and `geo.lng`
- Photos array is mapped to URLs only
- `hotel_policy` is passed through as-is from supplier

### Rooms & Rates
- Prices are treated as total stay amount (not per night)
- All monetary amounts are converted to minor units (cents)
- Currency defaults to USD if not specified in headers
- Infants are ignored in occupancy matching unless explicitly priced

## Business Rules

### Date Handling
- All dates processed in UTC format (YYYY-MM-DD)
- Check-out date is exclusive in range calculations
- Length of stay (LOS) = nights between check-in and check-out
- Maximum 30 days advance booking enforced

### Occupancy Matching
- Exact occupancy matching: `room.adults + room.children === request.adults + request.children`
- Infants are not counted in occupancy unless room has infant-specific pricing
- Adults minimum: 1, maximum: 8
- Children minimum: 0, maximum: 4
- Infants minimum: 0, maximum: 2

### Availability Rules
- Room rejected if any night in stay period is in closed dates
- Room rejected if check-in date has `closed_to_arrival: true`
- Room rejected if (check-out - 1) date has `closed_to_departure: true`
- Minimum stay rules: `min_stay_arrival` and `min_stay_through` must be ≤ LOS

## Caching Strategy

### Cache Keys
- Property: `property:{id}:info`
- Rooms: `rooms:{id}:{checkIn}:{checkOut}:A{adults}-C{children}-I{infants}:CUR={currency}`
- Idempotency: `idem:{key}:{id}:{checkIn}:{checkOut}:A{adults}-C{children}-I{infants}:{currency}`

### TTL & Jitter
- Property info: 24 hours (86400s) with 20% jitter
- Rooms: 5 minutes (300s) with 20% jitter
- Stale data: 2x normal TTL for fallback scenarios
- Idempotency: 1 hour (3600s)

### Fallback Behavior
- Supplier timeout → serve stale data if available, else 502
- Redis unavailable → bypass cache, never return 5xx for cache issues
- Circuit breaker open → serve stale data if available

## Error Handling

### Error Codes
- `INVALID_DATE_RANGE`: Check-out before check-in or > 30 days
- `INVALID_OCCUPANCY`: Adults/children outside allowed ranges
- `PROPERTY_NOT_FOUND`: Property ID not found in supplier
- `SUPPLIER_TIMEOUT`: Supplier response timeout (5s)
- `MISSING_IDEMPOTENCY_KEY`: Required for rooms endpoint

### HTTP Status Codes
- 400: Invalid request parameters
- 404: Property not found
- 502: Supplier timeout with `Retry-After: 60`
- 500: Internal server errors

## Circuit Breaker Configuration
- Error threshold: 50%
- Timeout: 5 seconds
- Reset timeout: 30 seconds
- Rolling window: 10 seconds with 10 buckets

## Observability

### Structured Logging
All requests logged with:
- `timestamp`, `level`, `message`
- `request_id`, `property_id`
- `cache_outcome`: hit|miss|stale_served|bypass|idempotent
- `duration_ms`, `supplier_timeout` (boolean)
- `endpoint`, `status_code`

### Metrics
- `hotel_requests_total{endpoint,status_code}`
- `hotel_cache_operations_total{type,outcome}`
- `hotel_response_duration_seconds` (histogram)
- `supplier_requests_total{status}`
- `supplier_latency_seconds` (histogram)
- `circuit_state` (0: closed, 1: open, 2: half-open)