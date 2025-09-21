import { Router } from 'express';
import hotelsRouter from './hotels';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns service health status and basic metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               status: "healthy"
 *               timestamp: "2024-01-15T10:30:00Z"
 *               version: "2.0.0"
 *               uptime: 3600
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime()
  });
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: |
 *       Returns Prometheus-formatted metrics for monitoring.
 *       
 *       **Available Metrics:**
 *       - HTTP request duration and count
 *       - Supplier request success/failure rates
 *       - Cache hit/miss ratios
 *       - Circuit breaker state
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *             example: |
 *               # HELP http_requests_total Total HTTP requests
 *               # TYPE http_requests_total counter
 *               http_requests_total{method="GET",route="/hotels/:id",status_code="200"} 42
 */

router.use('/api/product/v2/hotels', hotelsRouter);

export default router;