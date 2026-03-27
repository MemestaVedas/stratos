import { Router, Request, Response } from 'express';
import { AlertRuleModel, AlertEventModel, PlaybookModel } from '../models/AlertRule';
import { logger } from '../utils/logger';

const router = Router();

// ===== ALERT RULES =====

// GET /api/alerts/rules - List alert rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const activeOnly = req.query.is_active === 'true';
    const rules = await AlertRuleModel.listByOrg(orgId, activeOnly);
    res.json({ status: 'success', data: rules });
  } catch (error) {
    logger.error('Error listing alert rules:', error);
    res.status(500).json({ error: 'Failed to list alert rules' });
  }
});

// GET /api/alerts/rules/:id - Get alert rule
router.get('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const rule = await AlertRuleModel.getById(req.params.id, orgId);
    if (!rule) return res.status(404).json({ error: 'Alert rule not found' });
    res.json({ status: 'success', data: rule });
  } catch (error) {
    logger.error('Error getting alert rule:', error);
    res.status(500).json({ error: 'Failed to get alert rule' });
  }
});

// POST /api/alerts/rules - Create alert rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, condition, severity, channels, playbook_id } = req.body;

    if (!name || !condition) {
      return res.status(400).json({ error: 'Name and condition are required' });
    }
    if (!condition.field || !condition.operator || condition.value === undefined) {
      return res.status(400).json({ error: 'Condition must have field, operator, and value' });
    }

    const rule = await AlertRuleModel.create(orgId, {
      name, condition, severity, channels, playbook_id
    });
    res.status(201).json({ status: 'success', data: rule });
  } catch (error) {
    logger.error('Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// PUT /api/alerts/rules/:id - Update alert rule
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const updated = await AlertRuleModel.update(req.params.id, orgId, req.body);
    if (!updated) return res.status(404).json({ error: 'Alert rule not found' });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    logger.error('Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// DELETE /api/alerts/rules/:id - Delete alert rule
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const deleted = await AlertRuleModel.delete(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: 'Alert rule not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// ===== ALERT EVENTS =====

// GET /api/alerts/events - List alert events
router.get('/events', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await AlertEventModel.listByOrg(orgId, status, limit);
    res.json({ status: 'success', data: events, count: events.length });
  } catch (error) {
    logger.error('Error listing alert events:', error);
    res.status(500).json({ error: 'Failed to list alert events' });
  }
});

// PATCH /api/alerts/events/:id/snooze - Snooze alert
router.patch('/events/:id/snooze', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { days, note } = req.body;

    if (!days || days < 1 || days > 90) {
      return res.status(400).json({ error: 'Snooze days must be between 1 and 90' });
    }

    const snoozed = await AlertEventModel.snooze(req.params.id, orgId, days, note);
    if (!snoozed) return res.status(404).json({ error: 'Alert event not found' });
    res.json({ status: 'success', data: snoozed });
  } catch (error) {
    logger.error('Error snoozing alert:', error);
    res.status(500).json({ error: 'Failed to snooze alert' });
  }
});

// PATCH /api/alerts/events/:id/resolve - Resolve alert
router.patch('/events/:id/resolve', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { note } = req.body;
    const resolved = await AlertEventModel.resolve(req.params.id, orgId, note);
    if (!resolved) return res.status(404).json({ error: 'Alert event not found' });
    res.json({ status: 'success', data: resolved });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// ===== PLAYBOOKS =====

// GET /api/alerts/playbooks - List playbooks
router.get('/playbooks', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const playbooks = await PlaybookModel.listByOrg(orgId);
    res.json({ status: 'success', data: playbooks });
  } catch (error) {
    logger.error('Error listing playbooks:', error);
    res.status(500).json({ error: 'Failed to list playbooks' });
  }
});

// POST /api/alerts/playbooks - Create playbook
router.post('/playbooks', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, description, steps } = req.body;

    if (!name) return res.status(400).json({ error: 'Playbook name is required' });

    const playbook = await PlaybookModel.create(orgId, { name, description, steps });
    res.status(201).json({ status: 'success', data: playbook });
  } catch (error) {
    logger.error('Error creating playbook:', error);
    res.status(500).json({ error: 'Failed to create playbook' });
  }
});

export default router;
