import { Request, Response, NextFunction } from 'express';

interface RoomsRequest {
  check_in: string;
  check_out: string;
  adults: number;
  children?: number;
  infants?: number;
}

const validateRoomsData = (data: any): { valid: boolean; error?: string; field?: string; code?: string } => {
  if (!data.check_in || typeof data.check_in !== 'string') {
    return { valid: false, error: 'check_in is required and must be a string', field: 'check_in' };
  }
  
  if (!data.check_out || typeof data.check_out !== 'string') {
    return { valid: false, error: 'check_out is required and must be a string', field: 'check_out' };
  }
  
  if (!data.adults || typeof data.adults !== 'number' || data.adults < 1 || data.adults > 8) {
    return { valid: false, error: 'adults must be between 1 and 8', field: 'adults' };
  }
  
  if (data.children !== undefined && (typeof data.children !== 'number' || data.children < 0 || data.children > 4)) {
    return { valid: false, error: 'children must be between 0 and 4', field: 'children' };
  }
  
  if (data.infants !== undefined && (typeof data.infants !== 'number' || data.infants < 0 || data.infants > 2)) {
    return { valid: false, error: 'infants must be between 0 and 2', field: 'infants' };
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.check_in)) {
    return { valid: false, error: 'Invalid date format, use YYYY-MM-DD', field: 'check_in' };
  }
  
  if (!dateRegex.test(data.check_out)) {
    return { valid: false, error: 'Invalid date format, use YYYY-MM-DD', field: 'check_out' };
  }
  
  const checkIn = new Date(data.check_in);
  const checkOut = new Date(data.check_out);
  
  if (checkOut <= checkIn) {
    return { valid: false, error: 'Check-out date must be after check-in date', field: 'check_out', code: 'INVALID_DATE_RANGE' };
  }
  
  return { valid: true };
};

export const validateRoomsRequest = (req: Request, res: Response, next: NextFunction) => {
  const validation = validateRoomsData(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: {
        code: validation.code || 'VALIDATION_ERROR',
        message: validation.error || 'Invalid request data',
        details: { 
          field: validation.field || 'unknown', 
          reason: validation.error || 'Validation failed' 
        }
      }
    });
  }
  
  // Set defaults
  req.body.children = req.body.children || 0;
  req.body.infants = req.body.infants || 0;
  
  next();
};

export const validateIdempotencyKey = (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers['idempotency-key']) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required',
        details: { field: 'idempotency-key', reason: 'Required header missing' }
      }
    });
  }
  next();
};