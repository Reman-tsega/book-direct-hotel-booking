import { Router } from 'express';
import { validateRooms } from '../middlewares/validation';
import { getProperty } from '../controllers/propertyController';
import { getRooms } from '../controllers/roomsController';

const router = Router();

/**
 * @swagger
 * /api/product/v2/hotels/{id}:
 *   get:
 *     summary: Get property information
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: header
 *         name: x-currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Property information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Property'
 *       404:
 *         description: Property not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: Supplier timeout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getProperty as any);

/**
 * @swagger
 * /api/product/v2/hotels/{id}/get-rooms:
 *   post:
 *     summary: Get available rooms
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID
 *       - in: header
 *         name: idempotency-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Idempotency key for request
 *       - in: header
 *         name: x-currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency code
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
 *                 example: "2024-12-25"
 *               check_out:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-27"
 *               adults:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *               children:
 *                 type: integer
 *                 minimum: 0
 *                 example: 0
 *               infants:
 *                 type: integer
 *                 minimum: 0
 *                 example: 0
 *     responses:
 *       200:
 *         description: Available rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: Supplier timeout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/get-rooms', validateRooms as any, getRooms as any);

export default router;