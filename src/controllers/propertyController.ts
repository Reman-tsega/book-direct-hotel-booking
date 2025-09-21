import { Request, Response } from 'express';

interface RequestWithId extends Request {
  requestId: string;
}
import { fetchPropertyInfo } from '../services/supplierService';
import { get as cacheGet, set as cacheSet } from '../services/cacheService';
import { getPropertyCacheKey } from '../utils/helpers';
import logger from '../utils/logger';
import { hotelRequestsTotal, hotelResponseDurationSeconds, hotelCacheOperationsTotal } from '../utils/metrics';

export const getProperty = async (req: RequestWithId, res: Response) => {
  const { id } = req.params;
  const endpoint = '/api/product/v2/hotels/:id';
  const start = Date.now();
  let cacheOutcome = 'miss';
  let supplierTimeout = false;
  let statusCode = 200;

  try {
    const cacheKey = getPropertyCacheKey(id);
    let data: any = await cacheGet(cacheKey);
    if (data) {
      data = JSON.parse(data);
      cacheOutcome = 'hit';
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
    } else {
      data = await fetchPropertyInfo(id, req.requestId);
      await cacheSet(cacheKey, JSON.stringify(data), 86400); // 24h
      cacheOutcome = 'rebuild';
    }

    const currency = (req.headers['x-currency'] as string) || data.hotel_policy?.currency || 'USD';
    const property = {
      id: data.id ?? null,
      title: data.title ?? data.name ?? null,
      address: data.address ?? null,
      geo: { lat: data.location?.latitude ?? null, lng: data.location?.longitude ?? null },
      facilities: data.facilities ?? [],
      photos: data.photos ?? [],
      hotel_policy: {
        currency,
        check_in: data.hotel_policy?.checkin_from_time ?? null,
        check_out: data.hotel_policy?.checkout_to_time ?? null,
      },
    };

    res.json(property);
  } catch (err: any) {
    supplierTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    statusCode = err.response?.status || 502;
    if (statusCode === 404) {
      res.status(404).json({ error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } });
    } else {
      const cacheKey = getPropertyCacheKey(id);
      const stale = await cacheGet(cacheKey);
      if (stale) {
        cacheOutcome = 'stale_served';
        res.json(JSON.parse(stale));
      } else {
        res.set('Retry-After', '60');
        res.status(502).json({ error: { code: 'SUPPLIER_TIMEOUT', message: 'Supplier timeout' } });
      }
    }
  } finally {
    hotelRequestsTotal.inc({ endpoint, status_code: statusCode.toString() });
    hotelResponseDurationSeconds.observe((Date.now() - start) / 1000);
    logger.info({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Property request',
      request_id: req.requestId,
      property_id: id,
      cache_outcome: cacheOutcome,
      duration_ms: Date.now() - start,
      supplier_timeout: supplierTimeout,
      endpoint,
      status_code: statusCode,
    });
  }
};