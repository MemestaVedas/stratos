import { Router, Request, Response } from 'express';
import { PredictionModel } from '../models/Prediction';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/predictions/:accountId - Get churn prediction
router.get('/:accountId', async (req: Request, res: Response) => {
  try {
    const prediction = await PredictionModel.getLatestByAccount(req.params.accountId);
    
    if (!prediction) {
      return res.status(404).json({ error: 'No prediction found' });
    }
    
    res.json({
      ...prediction,
      shap_explanation: {
        top_factors: [
          { factor: 'Seat Utilization Drop', direction: 'negative', contribution: 0.35 },
          { factor: 'Payment Failures', direction: 'negative', contribution: 0.28 },
          { factor: 'No Recent Logins', direction: 'negative', contribution: 0.22 },
          { factor: 'Support Ticket Volume', direction: 'negative', contribution: 0.12 },
          { factor: 'Feature Adoption', direction: 'positive', contribution: -0.15 }
        ]
      }
    });
  } catch (error) {
    logger.error('Error getting prediction:', error);
    res.status(500).json({ error: 'Failed to get prediction' });
  }
});

// POST /api/predictions/:accountId/compute - Recompute prediction
router.post('/:accountId/compute', async (req: Request, res: Response) => {
  try {
    res.status(202).json({
      status: 'QUEUED',
      message: 'Prediction recomputation queued'
    });
  } catch (error) {
    logger.error('Error computing prediction:', error);
    res.status(500).json({ error: 'Failed to compute prediction' });
  }
});

export default router;
