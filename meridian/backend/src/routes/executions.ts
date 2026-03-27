import { Router, Request, Response } from 'express';
import { ExecutionModel } from '../models/Execution';
import { ExecutionEngine, executionEvents } from '../services/ExecutionEngine';
import { getPool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/workflows/:workflowId/executions - List executions for a workflow
router.get('/workflows/:workflowId/executions', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { executions, total } = await ExecutionModel.listByWorkflow(
      req.params.workflowId, orgId, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      }
    );

    res.json({
      status: 'success',
      data: executions,
      pagination: { total, limit: 50, offset: 0 }
    });
  } catch (error) {
    logger.error('Error listing executions:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

// GET /api/executions/:id - Get execution details with node-by-node results
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const execution = await ExecutionModel.getById(req.params.id, orgId);

    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    res.json({
      status: 'success',
      data: {
        ...execution,
        cost_summary: {
          total_tokens: execution.total_tokens,
          total_cost_usd: execution.total_cost_usd,
          node_costs: (execution.node_results || [])
            .filter(n => n.tokens_used)
            .map(n => ({
              node_id: n.node_id,
              tokens: n.tokens_used?.total || 0,
              cost_usd: n.tokens_used?.cost_usd || 0,
            })),
        }
      }
    });
  } catch (error) {
    logger.error('Error getting execution:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

// POST /api/workflows/:workflowId/execute - Trigger a new execution
router.post('/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const wsId = req.headers['x-workspace-id'] as string || 'default';
    const { input, wait_for_completion = false } = req.body;

    // Get workflow
    const pool = getPool();
    const wfResult = await pool.query(
      `SELECT * FROM workflows WHERE id = $1 AND org_id = $2`,
      [req.params.workflowId, orgId]
    );
    if (!wfResult.rows[0]) return res.status(404).json({ error: 'Workflow not found' });
    const workflow = wfResult.rows[0];

    // Create execution record
    const execution = await ExecutionModel.create(workflow.id, orgId, wsId, {
      trigger_source: 'api',
      input_data: input,
    });

    if (wait_for_completion) {
      // Synchronous execution
      const result = await ExecutionEngine.executeWorkflow(
        execution.id,
        workflow.nodes || [],
        workflow.edges || [],
        input,
        orgId
      );

      const updated = await ExecutionModel.getById(execution.id, orgId);
      res.json({ status: 'success', data: updated });
    } else {
      // Async execution — enqueue and return immediately
      setImmediate(async () => {
        try {
          await ExecutionEngine.executeWorkflow(
            execution.id,
            workflow.nodes || [],
            workflow.edges || [],
            input,
            orgId
          );
        } catch (err) {
          logger.error(`Async execution ${execution.id} failed:`, err);
        }
      });

      res.status(202).json({
        status: 'success',
        data: {
          execution_id: execution.id,
          status: 'queued',
          message: 'Execution queued. Use GET /api/executions/:id to poll status.',
        }
      });
    }
  } catch (error) {
    logger.error('Error triggering execution:', error);
    res.status(500).json({ error: 'Failed to trigger execution' });
  }
});

// POST /api/executions/:id/cancel - Cancel a running execution
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const cancelled = await ExecutionModel.cancel(req.params.id, orgId);
    if (!cancelled) return res.status(404).json({ error: 'Execution not found or not cancellable' });
    res.json({ status: 'success', data: cancelled });
  } catch (error) {
    logger.error('Error cancelling execution:', error);
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

// POST /api/executions/:id/replay - Replay a completed/failed execution
router.post('/:id/replay', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const original = await ExecutionModel.getById(req.params.id, orgId);
    if (!original) return res.status(404).json({ error: 'Execution not found' });

    // Replay is essentially a new execution with the same input
    const pool = getPool();
    const wfResult = await pool.query(`SELECT * FROM workflows WHERE id = $1`, [original.workflow_id]);
    if (!wfResult.rows[0]) return res.status(404).json({ error: 'Original workflow not found' });

    const newExec = await ExecutionModel.create(original.workflow_id, orgId, original.workspace_id, {
      trigger_source: 'manual',
      input_data: original.input_data,
    });

    setImmediate(async () => {
      await ExecutionEngine.executeWorkflow(
        newExec.id, wfResult.rows[0].nodes || [], wfResult.rows[0].edges || [],
        original.input_data, orgId
      );
    });

    res.status(202).json({
      status: 'success',
      data: {
        execution_id: newExec.id,
        replayed_from: req.params.id,
        status: 'queued',
      }
    });
  } catch (error) {
    logger.error('Error replaying execution:', error);
    res.status(500).json({ error: 'Failed to replay execution' });
  }
});

// GET /api/executions/:id/stream - SSE stream for real-time execution updates
router.get('/:id/stream', async (req: Request, res: Response) => {
  const executionId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const onStatus = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`event: status\ndata: ${JSON.stringify(data)}\n\n`);
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        cleanup();
      }
    }
  };

  const onNodeComplete = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`event: node_complete\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  executionEvents.on('status', onStatus);
  executionEvents.on('node_complete', onNodeComplete);

  // Send initial state
  res.write(`event: connected\ndata: ${JSON.stringify({ executionId })}\n\n`);

  const cleanup = () => {
    executionEvents.off('status', onStatus);
    executionEvents.off('node_complete', onNodeComplete);
    res.end();
  };

  req.on('close', cleanup);

  // Timeout after 5 minutes
  setTimeout(cleanup, 300000);
});

// GET /api/executions/metrics - Execution metrics for org
router.get('/org/metrics', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const metrics = await ExecutionModel.getMetrics(orgId);
    res.json({ status: 'success', data: metrics });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
