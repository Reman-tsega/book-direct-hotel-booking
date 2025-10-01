import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface RequestWithId extends Request {
  requestId: string;
}

const requestId = (req: RequestWithId, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
};

export default requestId;