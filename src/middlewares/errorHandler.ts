import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface CustomError extends Error {
  code?: string;
  status?: number;
}

interface RequestWithId extends Request {
  requestId?: string;
}

const errorHandler = (err: CustomError, req: RequestWithId, res: Response, next: NextFunction) => {
  const requestId = req.requestId || 'unknown';
  const code = err.code || 'INTERNAL_ERROR';
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  logger.error('Unhandled error', { error: message, code, status, requestId });
  
  res.status(status).json({ error: { code, message } });
};

export default errorHandler;