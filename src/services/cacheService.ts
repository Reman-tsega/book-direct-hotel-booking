import { createClient } from 'redis';
import { env } from '../config/env';
import logger from '../utils/logger';
import { addJitter } from '../utils/helpers';

class CacheService {
  private client: any;

  constructor() {
    this.client = createClient({ url: env.REDIS_URL });
    this.client.on('error', (err: any) => logger.error('Redis error', { error: err.message }));
    this.client.connect();
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error: any) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async getStale(key: string): Promise<string | null> {
    try {
      const staleKey = `stale:${key}`;
      return await this.client.get(staleKey);
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: string, ttl: number = env.CACHE_TTL_SECONDS): Promise<void> {
    try {
      const jitteredTtl = addJitter(ttl, env.CACHE_JITTER_PERCENT);
      await this.client.setEx(key, jitteredTtl, value);
      await this.client.setEx(`stale:${key}`, jitteredTtl * 2, value);
    } catch (error: any) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;
      const result = await this.client.set(lockKey, '1', { NX: true, EX: ttl });
      return result === 'OK';
    } catch (error) {
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.client.del(`lock:${key}`);
    } catch (error: any) {
      logger.error('Cache unlock error', { key, error: error.message });
    }
  }
}

export default new CacheService();
export const { get, set, acquireLock } = new CacheService();