import { Router, Request, Response } from 'express';
import { WorkflowModel } from '../models/Workflow';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/workflows - List workflows
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const workflows = await WorkflowModel.listByWorkspace(workspaceId, limit, offset);
    res.json({ data: workflows, count: workflows.length });
  } catch (error) {
    logger.error('Error listing workflows:', error);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// GET /api/workflows/:id - Get workflow
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const workflow = await WorkflowModel.getByIdAndWorkspace(req.params.id, workspaceId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json(workflow);
  } catch (error) {
    logger.error('Error getting workflow:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// POST /api/workflows - Create workflow
router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Workflow name is required' });
    }
    
    const workflow = await WorkflowModel.create(workspaceId, name, description || '');
    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { name, description, nodes, edges } = req.body;
    
    const workflow = await WorkflowModel.update(req.params.id, workspaceId, {
      name,
      description,
      nodes,
      edges,
    } as any);
    
    res.json(workflow);
  } catch (error) {
    logger.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const deleted = await WorkflowModel.delete(req.params.id, workspaceId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
