import * as crypto from 'crypto';
import { env } from '../config/env';

export function getJitteredTTL(baseTTL: number): number {
  const jitter = Math.random() * baseTTL * env.CACHE_JITTER_PERCENT;
  return Math.floor(baseTTL + jitter);
}

export function calculateLOS(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function generateIdemKey(params: any): string {
  return `idem:${crypto.createHash('md5').update(JSON.stringify(params)).digest('hex')}`;
}

export function getPropertyCacheKey(id: string): string {
  return `property:${id}:info`;
}

export function getRoomsCacheKey(id: string, checkIn: string, checkOut: string, adults: number, children: number, infants: number, currency: string, isMobile = 0): string {
  return `rooms:${id}:${checkIn}:${checkOut}:A${adults}-C${children}-I${infants}:CUR=${currency}:MOB=${isMobile}`;
}