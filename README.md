# Book Direct - Hotel Booking Aggregation Service

A resilient hotel booking aggregation service that handles supplier API failures gracefully.

## Setup

1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Start services: `docker-compose up -d`
4. Start app: `npm run dev`

## Testing

- Acceptance tests: `npm run test:acceptance`
- Reliability tests: `npm run test:reliability`

## API Endpoints

- `GET /properties` - Search properties
- `GET /properties/:id/rooms` - Get available rooms