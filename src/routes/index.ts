import { Router } from 'express';
import hotelsRouter from './hotels';

const router = Router();

router.use('/api/product/v2/hotels', hotelsRouter);

export default router;