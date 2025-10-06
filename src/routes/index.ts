import { Router } from 'express';
import hotelRoutes from './hotels';
import { register } from '../utils/metrics';
import { testChannexAPI } from '../controllers/testController';

const router = Router();

router.use('/api/product/v2/hotels', hotelRoutes);

// Test endpoint for direct Channex API calls
router.get('/test/channex/:endpoint', testChannexAPI);

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;