import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface RequestWithId extends Request {
  requestId?: string;
}

const errorHandler = (err: any, req: RequestWithId, res: Response, next: NextFunction) => {
  logger.error('Error occurred', { 
    error: err.message, 
    stack: err.stack, 
    requestId: req.requestId 
  });

  if (err.code === 'SUPPLIER_TIMEOUT') {
    return res.status(503).json({ 
      error: {
        code: 'SUPPLIER_TIMEOUT',
        message: 'Service temporarily unavailable'
      }
    });
  }

  if (err.status === 404) {
    return res.status(404).json({
      error: {
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found'
      }
    });
  }

  res.status(500).json({ 
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
};

export default errorHandler;