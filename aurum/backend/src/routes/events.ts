import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/events/ingest - Ingest usage events
router.post('/ingest/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const events = req.body.events || [];
    
    logger.info(`Ingesting ${events.length} events for org ${orgId}`);
    
    res.status(202).json({
      status: 'ACCEPTED',
      events_processed: events.length,
      message: 'Events queued for processing'
    });
  } catch (error) {
    logger.error('Error ingesting events:', error);
    res.status(500).json({ error: 'Failed to ingest events' });
  }
});

// GET /api/events/history/:accountId - Get account event history
router.get('/history/:accountId', async (req: Request, res: Response) => {
  try {
    res.json({
      events: [
        { type: 'usage', timestamp: Date.now() - 86400000, description: 'Feature "advanced_export" used' },
        { type: 'billing', timestamp: Date.now() - 172800000, description: 'Plan downgrade initiated' },
        { type: 'support', timestamp: Date.now() - 259200000, description: '3 new support tickets' }
      ]
    });
  } catch (error) {
    logger.error('Error fetching event history:', error);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

export default router;
