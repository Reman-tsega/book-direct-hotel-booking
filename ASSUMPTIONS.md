# Assumptions

## Business Rules
- **Occupancy Matching**: Exact occupancy matching required (adults + children must equal room capacity)
- **Price Semantics**: Prices returned as total stay amount, converted to minor units (cents)
- **Tax Inclusion**: Taxes returned separately from base price
- **Timezone**: All dates processed in UTC format (YYYY-MM-DD)
- **Booking Window**: Maximum 30 days advance booking allowed
- **Stay Duration**: Minimum 1 night, maximum determined by supplier

## Technical Assumptions
- **Cache Strategy**: TTL with 20% jitter to prevent thundering herd
- **Stale Cache**: Served during supplier outages with 2x TTL
- **Fallback Behavior**: Stale cache preferred over 502 errors
- **Idempotency**: Request deduplication via idempotency-key header
- **Circuit Breaker**: Supplier timeout triggers stale cache or 502 response
- **Lock Mechanism**: Redis-based locks prevent cache stampede

## Data Handling
- **Missing Fields**: Explicitly set to null in responses
- **Currency**: Defaults to hotel policy currency or USD
- **Closed Dates**: Full date range validation including arrival/departure restrictions
- **Min Stay**: Enforced at both arrival and through-stay levels