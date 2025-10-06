import * as promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const hotelRequestsTotal = new promClient.Counter({
  name: 'hotel_requests_total',
  help: 'Total hotel requests',
  labelNames: ['endpoint', 'status_code'],
  registers: [register]
});

const hotelCacheOperationsTotal = new promClient.Counter({
  name: 'hotel_cache_operations_total',
  help: 'Cache operations',
  labelNames: ['type', 'outcome'],
  registers: [register]
});

const hotelResponseDurationSeconds = new promClient.Histogram({
  name: 'hotel_response_duration_seconds',
  help: 'Response duration',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

const supplierRequestsTotal = new promClient.Counter({
  name: 'supplier_requests_total',
  help: 'Supplier requests',
  labelNames: ['status'],
  registers: [register]
});

const supplierLatencySeconds = new promClient.Histogram({
  name: 'supplier_latency_seconds',
  help: 'Supplier latency',
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const circuitStateGauge = new promClient.Gauge({
  name: 'circuit_state',
  help: 'Circuit breaker state (0: closed, 1: open, 2: half-open)',
  registers: [register]
});

export {
  register,
  hotelRequestsTotal,
  hotelCacheOperationsTotal,
  hotelResponseDurationSeconds,
  supplierRequestsTotal,
  supplierLatencySeconds,
  circuitStateGauge,
};