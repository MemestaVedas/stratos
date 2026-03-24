import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/analytics/:indexId - Get query analytics
router.get('/:indexId', async (req: Request, res: Response) => {
  try {
    res.json({
      query_volume: { today: 1523, this_week: 8945, this_month: 32100 },
      zero_result_queries: { count: 123, percentage: 3.8 },
      latency_percentiles: { p50: 450, p90: 1200, p99: 2500 },
      top_queries: [
        { query: 'How to deploy?', count: 45 },
        { query: 'Configuration guide', count: 38 }
      ],
      source_heatmap: {
        'api-docs.md': 234,
        'deployment-guide.pdf': 189,
        'troubleshooting.md': 156
      }
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
