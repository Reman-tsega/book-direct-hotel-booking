import { Router, Request, Response, NextFunction } from 'express';
import { getProperty, getPropertyList } from '../controllers/propertyController';
import { getRooms } from '../controllers/roomsController';
import { validateRoomsRequest, validateIdempotencyKey } from '../middlewares/validation';

interface RequestWithId extends Request {
  requestId: string;
}

const router = Router();

/**
 * @swagger
 * /api/product/v2/hotels:
 *   get:
 *     summary: Get property list with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: header
 *         name: x-request-id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property list with pagination
 *       502:
 *         description: Supplier timeout
 */
router.get('/', getPropertyList as any);

/**
 * @swagger
 * /api/product/v2/hotels/{id}:
 *   get:
 *     summary: Get property information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-currency
 *         schema:
 *           type: string
 *           default: USD
 *       - in: header
 *         name: x-request-id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property information
 *       404:
 *         description: Property not found
 *       502:
 *         description: Supplier timeout
 */
router.get('/:id', getProperty as any);

/**
 * @swagger
 * /api/product/v2/hotels/{id}/get-rooms:
 *   post:
 *     summary: Get available rooms
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: idempotency-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-currency
 *         schema:
 *           type: string
 *           default: USD
 *       - in: header
 *         name: x-request-id
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - check_in
 *               - check_out
 *               - adults
 *             properties:
 *               check_in:
 *                 type: string
 *                 format: date
 *               check_out:
 *                 type: string
 *                 format: date
 *               adults:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 8
 *               children:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 4
 *                 default: 0
 *               infants:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0
 *     responses:
 *       200:
 *         description: Available rooms
 *       400:
 *         description: Invalid request
 *       502:
 *         description: Supplier timeout
 */
router.post('/:id/get-rooms', 
  validateIdempotencyKey,
  validateRoomsRequest,
  getRooms as any
);

export default router;