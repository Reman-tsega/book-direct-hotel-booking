import Redis from 'ioredis';
import logger from '../utils/logger';
import { env } from '../config/env';
import { getJitteredTTL } from '../utils/helpers';
import { hotelCacheOperationsTotal } from '../utils/metrics';

const client = new Redis(env.REDIS_URL);

client.on('error', (err) => logger.error('Redis Client Error', err));

export async function get(key: string): Promise<string | null> {
  try {
    return await client.get(key);
  } catch (err) {
    logger.error('Redis get error, bypassing', { err });
    hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'bypass' });
    return null;
  }
}

export async function set(key: string, value: string, ttl: number): Promise<void> {
  try {
    await client.set(key, value, 'EX', getJitteredTTL(ttl));
    hotelCacheOperationsTotal.inc({ type: 'write', outcome: 'success' });
  } catch (err) {
    logger.error('Redis set error', { err });
  }
}

export async function acquireLock(key: string, ttl = 10): Promise<boolean> {
  try {
    const lockKey = `${key}:lock`;
    const result = await client.set(lockKey, 'locked', 'EX', ttl, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.error('Redis lock error', { err });
    return false;
  }
}