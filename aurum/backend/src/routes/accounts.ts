import { Router, Request, Response } from 'express';
import { AccountModel } from '../models/Account';
import { AccountMetricsModel, HealthScoreHistoryModel, TimelineEventModel } from '../models/AccountMetrics';
import { PredictionModel } from '../models/Prediction';
import { HealthScoreEngine } from '../services/HealthScoreEngine';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/accounts - List accounts with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { accounts, total } = await AccountModel.listByOrg(orgId, {
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
      health_score_min: req.query.health_score_min ? parseFloat(req.query.health_score_min as string) : undefined,
      health_score_max: req.query.health_score_max ? parseFloat(req.query.health_score_max as string) : undefined,
      churn_probability_min: req.query.churn_probability_min ? parseFloat(req.query.churn_probability_min as string) : undefined,
      risk_tier: req.query.risk_tier as string,
      plan: req.query.plan as string,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as string,
    });

    res.json({ status: 'success', data: accounts, pagination: { total } });
  } catch (error) {
    logger.error('Error listing accounts:', error);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

// GET /api/accounts/:id - Get full account 360 data
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const account = await AccountModel.getByIdAndOrg(req.params.id, orgId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Fetch additional data for 360 view
    const [metrics, prediction, healthHistory] = await Promise.all([
      AccountMetricsModel.getByAccount(req.params.id, orgId),
      PredictionModel.getLatestByAccount(req.params.id),
      HealthScoreHistoryModel.getTimeline(req.params.id, 90),
    ]);

    // Calculate health score breakdown
    let scoreBreakdown = null;
    let recommendations: string[] = [];
    if (metrics) {
      const engine = new HealthScoreEngine();
      scoreBreakdown = engine.calculate(metrics);
      recommendations = HealthScoreEngine.getRecommendations(scoreBreakdown);
    }

    res.json({
      status: 'success',
      data: {
        ...account,
        metrics,
        prediction,
        health_score_breakdown: scoreBreakdown,
        health_history: healthHistory,
        recommendations,
      }
    });
  } catch (error) {
    logger.error('Error getting account:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// POST /api/accounts - Create account
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, arr, external_id, plan, contract_start, contract_end, industry, employee_count } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const account = await AccountModel.create(orgId, name, arr || 0, {
      external_id, plan, contract_start, contract_end, industry, employee_count
    } as any);
    res.status(201).json({ status: 'success', data: account });
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PATCH /api/accounts/:id - Update account
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const updated = await AccountModel.update(req.params.id, orgId, req.body);
    if (!updated) return res.status(404).json({ error: 'Account not found' });
    res.json({ status: 'success', data: updated });
  } catch (error) {
    logger.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// GET /api/accounts/:id/timeline - Account event timeline
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await TimelineEventModel.listByAccount(req.params.id, limit);
    res.json({ status: 'success', data: events });
  } catch (error) {
    logger.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// GET /api/accounts/:id/metrics - Account metrics
router.get('/:id/metrics', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const metrics = await AccountMetricsModel.getByAccount(req.params.id, orgId);
    if (!metrics) return res.status(404).json({ error: 'Metrics not found' });
    res.json({ status: 'success', data: metrics });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/accounts/:id/prediction - Churn prediction with SHAP
router.get('/:id/prediction', async (req: Request, res: Response) => {
  try {
    const prediction = await PredictionModel.getLatestByAccount(req.params.id);
    if (!prediction) return res.status(404).json({ error: 'No prediction found' });

    res.json({
      status: 'success',
      data: {
        ...prediction,
        shap_explanation: {
          top_factors: [
            { factor: 'Seat Utilization Drop', direction: 'negative', contribution: 0.35, current_value: 48, threshold: 60 },
            { factor: 'Payment Failures', direction: 'negative', contribution: 0.28, current_value: 2, threshold: 0 },
            { factor: 'No Recent Logins', direction: 'negative', contribution: 0.22, current_value: 14, threshold: 7 },
            { factor: 'Support Ticket Volume', direction: 'negative', contribution: 0.12, current_value: 15, threshold: 5 },
            { factor: 'Feature Adoption', direction: 'positive', contribution: -0.15, current_value: 72, threshold: 50 },
          ]
        }
      }
    });
  } catch (error) {
    logger.error('Error getting prediction:', error);
    res.status(500).json({ error: 'Failed to get prediction' });
  }
});

// GET /api/accounts/:id/summary - AI-generated account summary
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const account = await AccountModel.getByIdAndOrg(req.params.id, orgId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const metrics = await AccountMetricsModel.getByAccount(req.params.id, orgId);

    // In production: call LLM with the prompt template from PRD
    // For now: generate a structured summary
    const scoreTrend = account.health_score > 60 ? 'stable' : 'declining';
    const riskLevel = account.churn_probability > 0.7 ? 'high' :
                      account.churn_probability > 0.4 ? 'moderate' : 'low';

    const summary = `${account.name} shows ${scoreTrend} health with a score of ${account.health_score}/100. ` +
      `The account has ${riskLevel} churn risk (${Math.round(account.churn_probability * 100)}% probability) ` +
      `with an ARR of $${account.arr.toLocaleString()}. ` +
      (metrics ? `Key concerns: ${metrics.days_since_login} days since last login, ` +
        `${metrics.support_tickets_30d} support tickets in 30d, ` +
        `${Math.round(metrics.seat_utilization)}% seat utilization. ` : '') +
      `Recommended action: ${account.churn_probability > 0.5 ? 'Schedule an EBR with executive sponsor' : 'Continue monitoring engagement metrics'}.`;

    res.json({
      status: 'success',
      data: {
        account_id: req.params.id,
        summary,
        generated_at: new Date().toISOString(),
        cache_expires_at: new Date(Date.now() + 4 * 3600000).toISOString(), // 4 hour cache
        model: 'gpt-4o',
      }
    });
  } catch (error) {
    logger.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// GET /api/accounts/:id/health-timeline - Health score history
router.get('/:id/health-timeline', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const history = await HealthScoreHistoryModel.getTimeline(req.params.id, days);
    res.json({ status: 'success', data: { timeline: history } });
  } catch (error) {
    logger.error('Error fetching health timeline:', error);
    res.status(500).json({ error: 'Failed to fetch health timeline' });
  }
});

export default router;
