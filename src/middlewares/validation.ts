import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

interface RequestWithId extends Request {
  requestId?: string;
}

const roomsSchema = z.object({
  check_in: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid check_in date format"
  }),
  check_out: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid check_out date format"
  }),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0).optional().default(0),
  infants: z.coerce.number().int().min(0).optional().default(0)
});

export const validateRooms = (req: RequestWithId, res: Response, next: NextFunction) => {
  try {
    roomsSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: error.errors[0].message 
        } 
      });
    }
    next(error);
  }
};