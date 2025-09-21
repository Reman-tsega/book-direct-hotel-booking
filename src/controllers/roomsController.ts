import { Request, Response } from 'express';
import { fetchRooms, fetchClosedDates } from '../services/supplierService';
import { get as cacheGet, set as cacheSet, acquireLock } from '../services/cacheService';
import { getRoomsCacheKey, calculateLOS, generateIdemKey } from '../utils/helpers';
import logger from '../utils/logger';
import { hotelRequestsTotal, hotelResponseDurationSeconds, hotelCacheOperationsTotal } from '../utils/metrics';
import { env } from '../config/env';

interface RequestWithId extends Request {
  requestId: string;
}

interface Occupancy {
  adults?: number;
  children?: number;
}

interface Room {
  occupancy?: Occupancy;
  min_stay_arrival?: number;
  min_stay_through?: number;
  price?: number;
  currency?: string;
  taxes?: any[];
  cancellation_policy?: any;
}

interface RoomsResponse {
  rooms: Room[];
}

export const getRooms = async (req: RequestWithId, res: Response) => {
  const { id } = req.params;
  const { check_in, check_out, adults, children, infants = 0 } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const currency = (req.headers['x-currency'] as string) || 'USD';
  const endpoint = '/api/product/v2/hotels/:id/get-rooms';
  const start = Date.now();
  let cacheOutcome = 'miss';
  let supplierTimeout = false;
  let statusCode = 200;
  let data: { rooms: Room[] } | undefined;

  if (!idempotencyKey) {
    return res.status(400).json({ error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key required' } });
  }

  try {
    const checkIn = new Date(check_in).toISOString().split('T')[0];
    const checkOut = new Date(check_out).toISOString().split('T')[0];
    const los = calculateLOS(checkIn, checkOut);

    if (los <= 0) {
      statusCode = 400;
      throw { status: 400, code: 'INVALID_DATE_RANGE', message: 'Invalid date range' };
    }

    const idemParams = { id, checkIn, checkOut, adults, children, infants, currency, idempotencyKey };
    const idemKey = generateIdemKey(idemParams);
    let existing = await cacheGet(idemKey);
    if (existing) {
      return res.json(JSON.parse(existing));
    }

    const cacheKey = getRoomsCacheKey(id, checkIn, checkOut, adults, children, infants, currency);
    let cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      data = JSON.parse(cachedData);
      cacheOutcome = 'hit';
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
    } else {
      const locked = await acquireLock(cacheKey);
      if (!locked) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        cachedData = await cacheGet(cacheKey);
        if (cachedData) {
          cacheOutcome = 'hit_after_lock';
          hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit_after_lock' });
          data = JSON.parse(cachedData);
        }
      }

      if (!data) {
        const [roomsData, closedData] = await Promise.all([
          fetchRooms(id, checkIn, checkOut, req.requestId),
          fetchClosedDates(id, req.requestId),
        ]) as [RoomsResponse, any];

        const filteredRooms = roomsData.rooms
          .filter((rate) => {
            const occ = rate.occupancy || {};
            return (occ.adults || 0) + (occ.children || 0) === adults + children;
          })
          .filter((room) => {
            const rangeStart = new Date(checkIn);
            const rangeEnd = new Date(checkOut);
            for (let d = new Date(rangeStart); d < rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              if (
                closedData.closed?.includes(dateStr) ||
                (dateStr === checkIn && closedData.closed_to_arrival?.includes(dateStr)) ||
                (new Date(d.getTime() + 86400000).toISOString().split('T')[0] === checkOut &&
                 closedData.closed_to_departure?.includes(dateStr))
              ) {
                return false;
              }
            }
            if ((room.min_stay_arrival || 0) > los || (room.min_stay_through || 0) > los) {
              return false;
            }
            return true;
          })
          .map((room) => {
            room.price = Math.round((room.price || 0) * 100);
            room.currency = currency;
            room.taxes = room.taxes || [];
            room.cancellation_policy = room.cancellation_policy || {};
            return room;
          });

        data = { rooms: filteredRooms };
        await cacheSet(cacheKey, JSON.stringify(data), env.CACHE_TTL_SECONDS);
        cacheOutcome = 'rebuild';
      }
    }

    await cacheSet(idemKey, JSON.stringify(data), 3600);
    res.json(data);
  } catch (err: any) {
    supplierTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    statusCode = err.status || 502;
    if (statusCode === 400) {
      return res.status(400).json({ error: { code: err.code, message: err.message } });
    } else {
      const cacheKey = getRoomsCacheKey(id, new Date(check_in).toISOString().split('T')[0], new Date(check_out).toISOString().split('T')[0], adults, children, infants, currency);
      const stale = await cacheGet(cacheKey);
      if (stale) {
        cacheOutcome = 'stale_served';
        hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'stale_served' });
        return res.json(JSON.parse(stale));
      }
      res.set('Retry-After', '60');
      res.status(502).json({ error: { code: 'SUPPLIER_TIMEOUT', message: 'Supplier timeout' } });
    }
  } finally {
    hotelRequestsTotal.inc({ endpoint, status_code: statusCode.toString() });
    hotelResponseDurationSeconds.observe((Date.now() - start) / 1000);
    logger.info({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Rooms request',
      request_id: req.requestId,
      property_id: id,
      date_range: `${check_in} to ${check_out}`,
      occupancy: { adults, children, infants },
      result_count: data?.rooms.length || 0,
      cache_outcome: cacheOutcome,
      duration_ms: Date.now() - start,
      supplier_timeout: supplierTimeout,
      endpoint,
      status_code: statusCode,
    });
  }
};