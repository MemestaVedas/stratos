import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/triggers/webhook/:workflowId - Handle incoming webhook trigger
router.post('/webhook/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const pool = getPool();

    // Get the trigger configuration
    const triggerResult = await pool.query(
      `SELECT t.*, w.org_id FROM triggers t
       JOIN workflows w ON t.workflow_id = w.id
       WHERE t.workflow_id = $1 AND t.trigger_type = 'webhook' AND t.is_active = true`,
      [workflowId]
    );

    if (!triggerResult.rows[0]) {
      return res.status(404).json({ error: 'No active webhook trigger for this workflow' });
    }

    const trigger = triggerResult.rows[0];

    // Verify HMAC signature if configured
    if (trigger.webhook_secret) {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;

      if (!signature || !timestamp) {
        return res.status(401).json({ error: 'Missing webhook signature or timestamp' });
      }

      const payload = JSON.stringify(req.body);
      const expected = 'sha256=' + crypto
        .createHmac('sha256', trigger.webhook_secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    }

    // Create execution from webhook
    const execId = uuidv4();
    await pool.query(
      `INSERT INTO executions (id, workflow_id, org_id, workspace_id, status, trigger_source,
        input_data, node_results, started_at, duration_ms, total_tokens, total_cost_usd, created_at)
       VALUES ($1, $2, $3, 'default', 'queued', 'webhook', $4, '[]'::jsonb, NOW(), 0, 0, 0, NOW())`,
      [execId, workflowId, trigger.org_id, JSON.stringify(req.body)]
    );

    logger.info(`Webhook trigger fired for workflow ${workflowId}, execution ${execId}`);

    res.status(202).json({
      status: 'success',
      data: { execution_id: execId, status: 'queued' }
    });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// GET /api/triggers/:workflowId - List triggers for a workflow
router.get('/:workflowId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM triggers WHERE workflow_id = $1 ORDER BY created_at DESC`,
      [req.params.workflowId]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    logger.error('Error listing triggers:', error);
    res.status(500).json({ error: 'Failed to list triggers' });
  }
});

// POST /api/triggers/:workflowId - Create a trigger
router.post('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { trigger_type, name, cron_expression, trigger_config } = req.body;
    const pool = getPool();
    const id = uuidv4();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/triggers/webhook/${req.params.workflowId}`;

    const query = `
      INSERT INTO triggers (id, workflow_id, trigger_type, name, webhook_url, webhook_secret,
        cron_expression, trigger_config, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      id, req.params.workflowId, trigger_type || 'webhook',
      name || `${trigger_type || 'webhook'} trigger`,
      trigger_type === 'webhook' ? webhookUrl : null,
      trigger_type === 'webhook' ? webhookSecret : null,
      cron_expression || null,
      JSON.stringify(trigger_config || {})
    ]);

    const triggerData = result.rows[0];
    if (trigger_type === 'webhook') {
      triggerData.webhook_url = webhookUrl;
      triggerData.webhook_secret = webhookSecret;
    }

    res.status(201).json({ status: 'success', data: triggerData });
  } catch (error) {
    logger.error('Error creating trigger:', error);
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

// DELETE /api/triggers/:workflowId/:triggerId - Delete a trigger
router.delete('/:workflowId/:triggerId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM triggers WHERE id = $1 AND workflow_id = $2`,
      [req.params.triggerId, req.params.workflowId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Trigger not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting trigger:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// PATCH /api/triggers/:workflowId/:triggerId/toggle - Toggle trigger active state
router.patch('/:workflowId/:triggerId/toggle', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE triggers SET is_active = NOT is_active WHERE id = $1 AND workflow_id = $2 RETURNING *`,
      [req.params.triggerId, req.params.workflowId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Trigger not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    logger.error('Error toggling trigger:', error);
    res.status(500).json({ error: 'Failed to toggle trigger' });
  }
});

export default router;
