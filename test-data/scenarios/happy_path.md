# Happy Path Test Scenario

## Property Info Request
```bash
curl -X GET "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f" \
  -H "x-currency: USD" \
  -H "x-request-id: test-req-001"
```

**Expected Response:**
- Status: 200 OK
- Cache outcome: miss (first request), hit (subsequent)
- Response includes: id, title, address, geo, facilities, photos, hotel_policy

## Rooms Request
```bash
curl -X POST "http://localhost:3000/api/product/v2/hotels/7299f84c-dd73-46ce-ae38-3d079de3927f/get-rooms" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-idem-001" \
  -H "x-currency: USD" \
  -H "x-request-id: test-req-002" \
  -d '{
    "check_in": "2024-12-25",
    "check_out": "2024-12-27",
    "adults": 2,
    "children": 0
  }'
```

**Expected Response:**
- Status: 200 OK
- Filtered rooms matching exact occupancy (2 adults, 0 children)
- Prices in minor units (cents)
- Available rooms excluding closed dates
- Minimum stay requirements satisfied

## Idempotency Test
Repeat the same rooms request with identical `idempotency-key`:

**Expected Behavior:**
- Same response returned
- Cache outcome: idempotent
- No additional supplier calls made