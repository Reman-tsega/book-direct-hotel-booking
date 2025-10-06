import CircuitBreaker from 'opossum';
import { supplierRequestsTotal, supplierLatencySeconds, circuitStateGauge } from '../utils/metrics';
import logger from '../utils/logger';

const options = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 5000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10
};

export const createCircuitBreaker = (name: string, fn: (...args: any[]) => Promise<any>) => {
  const breaker = new CircuitBreaker(fn, options);
  
  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened for ${name}`);
    circuitStateGauge.set(1);
  });
  
  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open for ${name}`);
    circuitStateGauge.set(2);
  });
  
  breaker.on('close', () => {
    logger.info(`Circuit breaker closed for ${name}`);
    circuitStateGauge.set(0);
  });
  
  breaker.on('success', (result: any, latency: number) => {
    supplierRequestsTotal.inc({ status: 'success' });
    supplierLatencySeconds.observe(latency / 1000);
  });
  
  breaker.on('failure', (error: any) => {
    supplierRequestsTotal.inc({ status: 'failure' });
    logger.error(`Circuit breaker failure for ${name}`, { error: error.message });
  });
  
  return breaker;
};