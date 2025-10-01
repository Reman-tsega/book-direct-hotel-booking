import { Router } from 'express';
import hotelRoutes from './hotels';

const router = Router();

router.use('/api/product/v2/hotels', hotelRoutes);

export default router;