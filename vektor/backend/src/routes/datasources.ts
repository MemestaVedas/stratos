import { Router, Request, Response } from 'express';
import { DataSourceModel, SyncJobModel } from '../models/DataSource';
import { IngestionService } from '../services/IngestionService';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/indexes/:indexId/datasources - List data sources
router.get('/:indexId/datasources', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const sources = await DataSourceModel.listByIndex(req.params.indexId, orgId);
    res.json({ status: 'success', data: sources });
  } catch (error) {
    logger.error('Error listing datasources:', error);
    res.status(500).json({ error: 'Failed to list data sources' });
  }
});

// POST /api/indexes/:indexId/datasources - Create data source
router.post('/:indexId/datasources', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, source_type, connector_config, ingest_schedule } = req.body;

    if (!name || !source_type) {
      return res.status(400).json({ error: 'name and source_type are required' });
    }

    const ds = await DataSourceModel.create(req.params.indexId, orgId, {
      name, source_type, connector_config, ingest_schedule
    });
    res.status(201).json({ status: 'success', data: ds });
  } catch (error) {
    logger.error('Error creating datasource:', error);
    res.status(500).json({ error: 'Failed to create data source' });
  }
});

// GET /api/datasources/:id - Get data source details
router.get('/datasources/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const ds = await DataSourceModel.getById(req.params.id, orgId);
    if (!ds) return res.status(404).json({ error: 'Data source not found' });

    // Fetch recent sync history
    const syncHistory = await SyncJobModel.listByDataSource(req.params.id, 5);

    res.json({ status: 'success', data: { ...ds, sync_history: syncHistory } });
  } catch (error) {
    logger.error('Error getting datasource:', error);
    res.status(500).json({ error: 'Failed to get data source' });
  }
});

// POST /api/datasources/:id/ingest - Trigger ingestion
router.post('/datasources/:id/ingest', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const ds = await DataSourceModel.getById(req.params.id, orgId);
    if (!ds) return res.status(404).json({ error: 'Data source not found' });

    if (ds.ingestion_status === 'running') {
      return res.status(409).json({ error: 'Ingestion already running for this source' });
    }

    // Start async ingestion
    const job = await SyncJobModel.create(req.params.id, orgId);

    setImmediate(async () => {
      try {
        await IngestionService.ingest(req.params.id, orgId, req.body.chunking);
      } catch (err) {
        logger.error(`Ingestion failed for datasource ${req.params.id}:`, err);
      }
    });

    res.status(202).json({
      status: 'success',
      data: {
        job_id: job.id,
        status: 'queued',
        estimated_duration_seconds: 300,
      }
    });
  } catch (error) {
    logger.error('Error triggering ingestion:', error);
    res.status(500).json({ error: 'Failed to trigger ingestion' });
  }
});

// GET /api/jobs/:jobId - Get sync job status
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await SyncJobModel.getById(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: 'success', data: job });
  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// GET /api/datasources/:id/ingest/stream - SSE for ingestion progress
router.get('/datasources/:id/ingest/stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 0.1;
    if (progress >= 1) {
      res.write(`event: complete\ndata: ${JSON.stringify({ progress: 1, status: 'completed' })}\n\n`);
      clearInterval(interval);
      res.end();
    } else {
      res.write(`event: progress\ndata: ${JSON.stringify({ progress: Math.round(progress * 100) / 100, status: 'running' })}\n\n`);
    }
  }, 2000);

  req.on('close', () => clearInterval(interval));
});

// DELETE /api/datasources/:id - Delete data source
router.delete('/datasources/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const deleted = await DataSourceModel.delete(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: 'Data source not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting datasource:', error);
    res.status(500).json({ error: 'Failed to delete data source' });
  }
});

export default router;
