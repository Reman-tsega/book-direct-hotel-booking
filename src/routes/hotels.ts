import { Router } from 'express';
import { validateRooms } from '../middlewares/validation';
import { getProperty } from '../controllers/propertyController';
import { getRooms } from '../controllers/roomsController';

const router = Router();

router.get('/:id', getProperty as any);
router.post('/:id/get-rooms', validateRooms as any, getRooms as any);

export default router;