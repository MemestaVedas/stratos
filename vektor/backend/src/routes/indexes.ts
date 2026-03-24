import { Router, Request, Response } from 'express';
import { IndexModel } from '../models/Index';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/indexes - List indexes
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const indexes = await IndexModel.listByWorkspace(workspaceId);
    res.json({ data: indexes });
  } catch (error) {
    logger.error('Error listing indexes:', error);
    res.status(500).json({ error: 'Failed to list indexes' });
  }
});

// GET /api/indexes/:id - Get index
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const index = await IndexModel.getByIdAndWorkspace(req.params.id, workspaceId);
    
    if (!index) {
      return res.status(404).json({ error: 'Index not found' });
    }
    
    res.json(index);
  } catch (error) {
    logger.error('Error getting index:', error);
    res.status(500).json({ error: 'Failed to get index' });
  }
});

// POST /api/indexes - Create index
router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { name, description, embedding_model, chunk_size, chunk_overlap } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    const index = await IndexModel.create(
      workspaceId,
      name,
      description || '',
      embedding_model || 'text-embedding-3-small',
      chunk_size || 1024,
      chunk_overlap || 20
    );
    
    res.status(201).json(index);
  } catch (error) {
    logger.error('Error creating index:', error);
    res.status(500).json({ error: 'Failed to create index' });
  }
});

// DELETE /api/indexes/:id - Delete index
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const deleted = await IndexModel.delete(req.params.id, workspaceId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Index not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting index:', error);
    res.status(500).json({ error: 'Failed to delete index' });
  }
});

export default router;
