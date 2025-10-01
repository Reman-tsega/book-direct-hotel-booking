import { Request, Response } from 'express';
import supplierService from '../services/supplierService';
import cacheService from '../services/cacheService';
import logger from '../utils/logger';
import { getRoomsCacheKey, calculateLOS, generateIdemKey } from '../utils/helpers';
import { hotelRequestsTotal, hotelResponseDurationSeconds, hotelCacheOperationsTotal } from '../utils/metrics';

interface RequestWithId extends Request {
  requestId: string;
}

const idempotencyStore = new Map<string, any>();

export const getRooms = async (req: RequestWithId, res: Response) => {
  const { id } = req.params;
  const { check_in, check_out, adults, children = 0, infants = 0 } = req.body;
  const currency = (req.headers['x-currency'] as string) || 'USD';
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const start = Date.now();
  let cacheOutcome = 'miss';
  let supplierTimeout = false;
  let statusCode = 200;
  let resultCount = 0;
  
  if (!idempotencyKey) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required'
      }
    });
  }

  // Validate date range
  const los = calculateLOS(check_in, check_out);
  if (los <= 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_DATE_RANGE',
        message: 'Check-out must be after check-in'
      }
    });
  }

  if (los > 30) {
    return res.status(400).json({
      error: {
        code: 'INVALID_DATE_RANGE',
        message: 'Maximum 30 days advance booking allowed'
      }
    });
  }

  try {
    // Check idempotency
    if (idempotencyStore.has(idempotencyKey)) {
      logger.info('Idempotent request', { requestId: req.requestId, idempotencyKey });
      return res.json(idempotencyStore.get(idempotencyKey));
    }

    const cacheKey = getRoomsCacheKey(id, check_in, check_out, adults, children, infants, currency);
    
    // Try cache first
    let cached = await cacheService.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      resultCount = data.length;
      logger.info('Cache hit', { 
        requestId: req.requestId, 
        propertyId: id, 
        cacheOutcome: 'hit',
        dateRange: `${check_in}:${check_out}`,
        occupancy: `A${adults}-C${children}`,
        resultCount
      });
      hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'hit' });
      
      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, data);
      }
      return res.json(data);
    }

    // Try to acquire lock
    const lockAcquired = await cacheService.acquireLock(cacheKey);
    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, 100));
      cached = await cacheService.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (idempotencyKey) {
          idempotencyStore.set(idempotencyKey, data);
        }
        return res.json(data);
      }
    }

    try {
      const rooms = await supplierService.getRooms(id, { 
        check_in, check_out, adults, children, infants, currency 
      });
      
      resultCount = rooms.length;
      await cacheService.set(cacheKey, JSON.stringify(rooms));
      
      logger.info('Cache rebuild', { 
        requestId: req.requestId, 
        propertyId: id, 
        cacheOutcome: 'rebuild',
        resultCount,
        dateRange: `${check_in}:${check_out}`,
        occupancy: `A${adults}-C${children}`
      });
      hotelCacheOperationsTotal.inc({ type: 'write', outcome: 'rebuild' });
      
      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, rooms);
      }
      
      res.json(rooms);
    } catch (error: any) {
      if (error.code === 'SUPPLIER_TIMEOUT') {
        const stale = await cacheService.getStale(cacheKey);
        if (stale) {
          const staleData = JSON.parse(stale);
          resultCount = staleData.length;
          
          logger.info('Stale cache served due to supplier timeout', { 
            requestId: req.requestId, 
            propertyId: id, 
            cacheOutcome: 'stale_served',
            supplierTimeout: true,
            dateRange: `${check_in}:${check_out}`,
            occupancy: `A${adults}-C${children}`,
            resultCount
          });
          hotelCacheOperationsTotal.inc({ type: 'read', outcome: 'stale_served' });
          res.setHeader('Retry-After', '60');
          
          if (idempotencyKey) {
            idempotencyStore.set(idempotencyKey, staleData);
          }
          return res.json(staleData);
        }
        
        statusCode = 502;
        supplierTimeout = true;
        res.setHeader('Retry-After', '60');
        return res.status(502).json({
          error: {
            code: 'SUPPLIER_TIMEOUT',
            message: 'Service temporarily unavailable'
          }
        });
      }
      throw error;
    } finally {
      if (lockAcquired) {
        await cacheService.releaseLock(cacheKey);
      }
    }
  } catch (error: any) {
    statusCode = 500;
    logger.error('Rooms controller error', { 
      error: error.message, 
      requestId: req.requestId, 
      propertyId: id 
    });
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  } finally {
    hotelRequestsTotal.inc({ endpoint: '/api/product/v2/hotels/:id/get-rooms', status_code: statusCode.toString() });
    hotelResponseDurationSeconds.observe((Date.now() - start) / 1000);
    
    logger.info('Rooms request completed', {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Rooms request',
      request_id: req.requestId,
      property_id: id,
      date_range: `${check_in} to ${check_out}`,
      occupancy: { adults, children, infants },
      result_count: resultCount,
      cache_outcome: cacheOutcome,
      duration_ms: Date.now() - start,
      supplier_timeout: supplierTimeout,
      endpoint: '/api/product/v2/hotels/:id/get-rooms',
      status_code: statusCode
    });
  }
};