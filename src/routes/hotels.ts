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
 *     description: |
 *       Retrieves detailed information about a specific hotel property.
 *       
 *       **Resilience Features:**
 *       - Circuit breaker protection
 *       - Stale data serving during outages
 *       - Request ID tracing
 *       - Automatic retry with exponential backoff
 *     tags: [Hotels]
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyId'
 *       - $ref: '#/components/parameters/Currency'
 *       - $ref: '#/components/parameters/RequestId'
 *     responses:
 *       200:
 *         description: Property information retrieved successfully
 *         headers:
 *           x-request-id:
 *             description: Request ID for tracing
 *             schema:
 *               type: string
 *           x-cache-status:
 *             description: Cache hit/miss status
 *             schema:
 *               type: string
 *               enum: [hit, miss, stale]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Property'
 *             examples:
 *               success:
 *                 summary: Successful property retrieval
 *                 value:
 *                   id: "123"
 *                   title: "Grand Hotel & Spa"
 *                   address: "123 Main St, New York, NY 10001"
 *                   geo:
 *                     lat: 40.7128
 *                     lng: -74.0060
 *                   facilities: ["WiFi", "Pool", "Gym"]
 *                   hotel_policy:
 *                     currency: "USD"
 *                     check_in: "15:00"
 *                     check_out: "11:00"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         $ref: '#/components/responses/ServiceUnavailable'
 *       500:
 *         description: Internal server error
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
 *     summary: Get available rooms for a property
 *     description: |
 *       Retrieves available rooms for specified dates and occupancy.
 *       
 *       **Business Rules:**
 *       - Exact occupancy matching (adults + children)
 *       - Minimum 1 night stay, maximum 30 days advance
 *       - Prices returned in cents (multiply by 100)
 *       - Closed dates and restrictions automatically filtered
 *       
 *       **Resilience Features:**
 *       - Idempotency protection via idempotency-key
 *       - Cache lock mechanism prevents thundering herd
 *       - Stale data serving during supplier outages
 *       - Automatic retry with jittered backoff
 *     tags: [Hotels]
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyId'
 *       - $ref: '#/components/parameters/IdempotencyKey'
 *       - $ref: '#/components/parameters/Currency'
 *       - $ref: '#/components/parameters/RequestId'
 *     requestBody:
 *       required: true
 *       description: Room search criteria
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomsRequest'
 *           examples:
 *             standard_request:
 *               summary: Standard room search
 *               value:
 *                 check_in: "2024-12-25"
 *                 check_out: "2024-12-27"
 *                 adults: 2
 *                 children: 0
 *             family_request:
 *               summary: Family room search
 *               value:
 *                 check_in: "2024-12-25"
 *                 check_out: "2024-12-30"
 *                 adults: 2
 *                 children: 2
 *                 infants: 1
 *     responses:
 *       200:
 *         description: Available rooms retrieved successfully
 *         headers:
 *           x-request-id:
 *             description: Request ID for tracing
 *             schema:
 *               type: string
 *           x-cache-status:
 *             description: Cache status
 *             schema:
 *               type: string
 *               enum: [hit, miss, rebuild, stale]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoomsResponse'
 *             examples:
 *               success:
 *                 summary: Successful rooms response
 *                 value:
 *                   rooms:
 *                     - occupancy:
 *                         adults: 2
 *                         children: 0
 *                       price: 15000
 *                       currency: "USD"
 *                       taxes:
 *                         - type: "VAT"
 *                           amount: 1500
 *                       cancellation_policy:
 *                         free_cancellation_until: "2024-12-24T23:59:59Z"
 *               no_availability:
 *                 summary: No rooms available
 *                 value:
 *                   rooms: []
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         $ref: '#/components/responses/ServiceUnavailable'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/get-rooms', validateRooms as any, getRooms as any);

export default router;