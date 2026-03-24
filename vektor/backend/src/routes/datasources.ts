import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/datasources - List data sources
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    res.json({ data: [] });
  } catch (error) {
    logger.error('Error listing datasources:', error);
    res.status(500).json({ error: 'Failed to list datasources' });
  }
});

// POST /api/datasources - Create data source
router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { name, type, index_id, config } = req.body;
    
    res.status(201).json({
      id: 'ds_' + Date.now(),
      name,
      type,
      status: 'PENDING',
      message: 'Data source created'
    });
  } catch (error) {
    logger.error('Error creating datasource:', error);
    res.status(500).json({ error: 'Failed to create datasource' });
  }
});

// POST /api/datasources/:id/sync - Trigger sync
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    res.status(202).json({
      sync_job_id: 'sync_' + Date.now(),
      status: 'STARTED',
      message: 'Ingestion pipeline started'
    });
  } catch (error) {
    logger.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;
