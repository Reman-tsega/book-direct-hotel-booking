import { Request, Response, NextFunction } from 'express';
import supplierService from '../services/supplierService';
import logger from '../utils/logger';

interface RequestWithId extends Request {
  requestId: string;
}

export const getPropertyList = async (req: RequestWithId, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20 } = req.query;
  const start = Date.now();
  
  try {
    logger.info('Getting property list', { 
      requestId: req.requestId, 
      page: Number(page), 
      limit: Number(limit) 
    });
    
    const result = await supplierService.getPropertyList({
      page: Number(page),
      limit: Number(limit)
    });
    
    logger.info('Property list retrieved successfully', { 
      requestId: req.requestId,
      count: result.data.length,
      duration_ms: Date.now() - start
    });
    
    res.json(result);
  } catch (error: any) {
    logger.error('Property list controller error', { 
      error: error.message, 
      stack: error.stack,
      requestId: req.requestId
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