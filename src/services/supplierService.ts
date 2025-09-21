import axios from 'axios';
import CircuitBreaker from 'opossum';
import { env } from '../config/env';
import logger from '../utils/logger';
import { supplierRequestsTotal, supplierLatencySeconds, circuitStateGauge } from '../utils/metrics';

interface CircuitParams {
  url: string;
  requestId: string;
  retryCount?: number;
}

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
}

const circuitOptions: CircuitBreakerOptions = {
  timeout: env.SUPPLIER_TIMEOUT_MS,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  volumeThreshold: 5,
};

const fetchSupplier = async (params: CircuitParams) => {
  const { url, requestId } = params;
  const start = Date.now();
  try {
    const response = await axios.get(url, {
      headers: { 'x-api-key': env.OPENSHOPPING_API_KEY, 'X-Request-Id': requestId },
      timeout: env.SUPPLIER_TIMEOUT_MS,
    });
    supplierLatencySeconds.observe((Date.now() - start) / 1000);
    supplierRequestsTotal.inc();
    return response.data.data?.attributes || response.data; // Adapt based on API
  } catch (error) {
    logger.error('Supplier error', { error: (error as Error).message });
    throw error;
  }
};

const circuit = new CircuitBreaker(fetchSupplier, circuitOptions);

circuit.fallback(() => { throw new Error('Circuit open'); });

circuit.on('open', () => circuitStateGauge.set(1));
circuit.on('close', () => circuitStateGauge.set(0));
circuit.on('halfOpen', () => circuitStateGauge.set(2));



export const fetchPropertyInfo = async (id: string, requestId: string) => {
  const url = `${env.OPENSHOPPING_BASE_URL}/${id}/property_info`;
  return circuit.fire({ url, requestId });
};

export const fetchRooms = async (id: string, checkIn: string, checkOut: string, requestId: string) => {
  const url = `${env.OPENSHOPPING_BASE_URL}/rooms?property_id=${id}&checkin_date=${checkIn}&checkout_date=${checkOut}`;
  return circuit.fire({ url, requestId });
};

export const fetchClosedDates = async (id: string, requestId: string) => {
  const url = `${env.OPENSHOPPING_BASE_URL}/closed_dates?property_id=${id}`;
  return circuit.fire({ url, requestId });
};