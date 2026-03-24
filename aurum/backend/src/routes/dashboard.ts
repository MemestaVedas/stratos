import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/dashboard/:orgId - Get executive dashboard metrics
router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    
    res.json({
      kpis: {
        arr: 2500000,
        mrr: 208333,
        nrr: 125.3,
        grr: 95.2,
        logo_churn_rate: 3.2
      },
      arr_movement: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        new: [50000, 55000, 60000, 65000, 70000],
        expansion: [30000, 32000, 35000, 38000, 42000],
        contraction: [-5000, -6000, -7000, -8000, -9000],
        churn: [-40000, -42000, -45000, -48000, -52000]
      },
      health_distribution: {
        healthy: 65,
        at_risk: 25,
        high_risk: 10
      },
      at_risk_accounts: [
        { name: 'Acme Corp', arr: 500000, churn_prob: 0.85, days_to_renewal: 45 },
        { name: 'TechCorp Inc', arr: 350000, churn_prob: 0.78, days_to_renewal: 60 },
        { name: 'DataFlow Systems', arr: 280000, churn_prob: 0.72, days_to_renewal: 30 }
      ],
      nrr_trend: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        values: [118.5, 120.2, 122.1, 123.8, 125.3]
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

export default router;
