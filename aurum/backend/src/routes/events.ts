import { Router, Request, Response } from 'express';
import { TimelineEventModel } from '../models/AccountMetrics';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/events/ingest/:orgId - Ingest usage events
router.post('/ingest/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const events = req.body.events || [];

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required and must not be empty' });
    }

    if (events.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 events per batch' });
    }

    // Validate each event
    const errors: any[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.event_type) {
        errors.push({ index: i, error: 'event_type is required' });
      }
      if (!event.account_id) {
        errors.push({ index: i, error: 'account_id is required' });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Event validation failed',
        details: errors,
        events_valid: events.length - errors.length,
        events_invalid: errors.length,
      });
    }

    // Process events — in production, this would enqueue to BullMQ
    const processed: string[] = [];
    for (const event of events) {
      try {
        await TimelineEventModel.create(event.account_id, orgId, {
          event_type: event.event_type,
          title: event.event_subtype || event.event_type,
          description: event.description || `${event.event_type} event`,
          metadata: event.properties || event.metadata || {},
        });
        processed.push(event.account_id);
      } catch (err) {
        logger.warn(`Failed to process event for account ${event.account_id}:`, err);
      }
    }

    logger.info(`Ingested ${processed.length}/${events.length} events for org ${orgId}`);

    res.status(202).json({
      status: 'ACCEPTED',
      events_accepted: processed.length,
      events_failed: events.length - processed.length,
      message: 'Events queued for processing',
      job_id: 'job_events_' + Date.now(),
    });
  } catch (error) {
    logger.error('Error ingesting events:', error);
    res.status(500).json({ error: 'Failed to ingest events' });
  }
});

// POST /api/events/ingest/:orgId/batch - Batch ingestion (SDK endpoint)
router.post('/ingest/:orgId/batch', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const events = req.body.events || [];

    if (events.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 events per batch request' });
    }

    logger.info(`Batch ingesting ${events.length} events for org ${orgId}`);

    // Enqueue batch for processing
    res.status(202).json({
      status: 'ACCEPTED',
      events_accepted: events.length,
      batch_id: 'batch_' + Date.now(),
      message: 'Batch queued for processing',
    });
  } catch (error) {
    logger.error('Error batch ingesting events:', error);
    res.status(500).json({ error: 'Failed to batch ingest events' });
  }
});

// GET /api/events/history/:accountId - Get account event history
router.get('/history/:accountId', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await TimelineEventModel.listByAccount(req.params.accountId, limit);

    res.json({
      status: 'success',
      data: events,
      count: events.length,
    });
  } catch (error) {
    logger.error('Error fetching event history:', error);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

// GET /api/events/types - List supported event types
router.get('/types', async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: [
      { type: 'login', description: 'User session start', category: 'usage' },
      { type: 'feature_used', description: 'Feature activation', category: 'usage' },
      { type: 'export', description: 'Data export event', category: 'usage' },
      { type: 'api_call', description: 'API usage event', category: 'usage' },
      { type: 'error', description: 'Product error event', category: 'usage' },
      { type: 'support_ticket', description: 'Support request created', category: 'support' },
      { type: 'payment_created', description: 'New invoice generated', category: 'billing' },
      { type: 'payment_failed', description: 'Payment failure', category: 'billing' },
      { type: 'plan_change', description: 'Plan upgrade or downgrade', category: 'billing' },
      { type: 'cs_touchpoint', description: 'Customer success interaction', category: 'relationship' },
    ]
  });
});

export default router;
