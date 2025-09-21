import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const roomsSchema = z.object({
  check_in: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid check_in date' }),
  check_out: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid check_out date' }),
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  infants: z.number().int().min(0).optional(),
});

export const validateRooms = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = roomsSchema.parse(req.body);
    next();
  } catch (err: any) {
    res.status(400).json({ error: { code: 'INVALID_OCCUPANCY', message: 'Invalid input', details: err.errors } });
  }
};