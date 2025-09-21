import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

interface RequestWithId extends Request {
  requestId: string;
}

export default (req: RequestWithId, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.set('X-Request-Id', req.requestId);
  next();
};