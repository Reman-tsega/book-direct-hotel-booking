import { Request, Response, NextFunction } from 'express';
import supplierService from '../services/supplierService';
import logger from '../utils/logger';
import { getPropertyCacheKey } from '../utils/helpers';

interface RequestWithId extends Request {
  requestId: string;
}

export const getProperty = async (req: RequestWithId, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const start = Date.now();
  
  try {
    logger.info('Getting property', { requestId: req.requestId, propertyId: id });
    
    const property = await supplierService.getPropertyInfo(id);
    
    logger.info('Property retrieved successfully', { 
      requestId: req.requestId, 
      propertyId: id,
      duration_ms: Date.now() - start
    });
    
    res.json(property);
  } catch (error: any) {
    logger.error('Property controller error', { 
      error: error.message, 
      stack: error.stack,
      requestId: req.requestId, 
      propertyId: id 
    });
    
    if (error.code === 'SUPPLIER_TIMEOUT') {
      res.setHeader('Retry-After', '60');
      return res.status(502).json({
        error: {
          code: 'SUPPLIER_TIMEOUT',
          message: 'Service temporarily unavailable'
        }
      });
    }
    
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
  }
};