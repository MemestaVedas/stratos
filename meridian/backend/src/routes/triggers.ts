import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/triggers/webhook/:workflowId - Webhook trigger endpoint
router.post('/webhook/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const payload = req.body;
    
    logger.info(`Webhook triggered for workflow ${workflowId}`, { payload });
    
    res.status(202).json({
      executionId: 'exec_' + Date.now(),
      status: 'QUEUED',
      message: 'Webhook payload received and queued'
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
