import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface AccountMetricsData {
  account_id: string;
  org_id: string;
  dau_7d: number;
  mau_30d: number;
  sessions_7d: number;
  feature_adoption: Record<string, number>;
  support_tickets_30d: number;
  avg_csat_90d: number;
  days_since_login: number;
  payment_failures_90d: number;
  seat_utilization: number;
  active_seats: number;
  licensed_seats: number;
  days_to_renewal: number;
  days_since_cs_touchpoint: number;
  last_updated: Date;
}

export interface HealthScoreSnapshot {
  id: string;
  account_id: string;
  org_id: string;
  score: number;
  engagement: number;
  utilization: number;
  support: number;
  financial: number;
  relationship: number;
  recorded_at: Date;
}

export interface TimelineEvent {
  id: string;
  account_id: string;
  org_id: string;
  event_type: 'usage' | 'billing' | 'support' | 'cs_touchpoint' | 'alert' | 'system';
  title: string;
  description: string;
  metadata: Record<string, any>;
  occurred_at: Date;
}

export class AccountMetricsModel {
  static async getByAccount(accountId: string, orgId: string): Promise<AccountMetricsData | null> {
    const pool = getPool();
    const query = `SELECT * FROM account_metrics WHERE account_id = $1 AND org_id = $2`;
    const result = await pool.query(query, [accountId, orgId]);
    return result.rows[0] || null;
  }

  static async upsert(accountId: string, orgId: string, metrics: Partial<AccountMetricsData>): Promise<AccountMetricsData> {
    const pool = getPool();
    const query = `
      INSERT INTO account_metrics (account_id, org_id, dau_7d, mau_30d, sessions_7d,
        feature_adoption, support_tickets_30d, avg_csat_90d, days_since_login,
        payment_failures_90d, seat_utilization, active_seats, licensed_seats,
        days_to_renewal, days_since_cs_touchpoint, last_updated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (account_id) DO UPDATE SET
        dau_7d = COALESCE(EXCLUDED.dau_7d, account_metrics.dau_7d),
        mau_30d = COALESCE(EXCLUDED.mau_30d, account_metrics.mau_30d),
        sessions_7d = COALESCE(EXCLUDED.sessions_7d, account_metrics.sessions_7d),
        feature_adoption = COALESCE(EXCLUDED.feature_adoption, account_metrics.feature_adoption),
        support_tickets_30d = COALESCE(EXCLUDED.support_tickets_30d, account_metrics.support_tickets_30d),
        avg_csat_90d = COALESCE(EXCLUDED.avg_csat_90d, account_metrics.avg_csat_90d),
        days_since_login = COALESCE(EXCLUDED.days_since_login, account_metrics.days_since_login),
        payment_failures_90d = COALESCE(EXCLUDED.payment_failures_90d, account_metrics.payment_failures_90d),
        seat_utilization = COALESCE(EXCLUDED.seat_utilization, account_metrics.seat_utilization),
        active_seats = COALESCE(EXCLUDED.active_seats, account_metrics.active_seats),
        licensed_seats = COALESCE(EXCLUDED.licensed_seats, account_metrics.licensed_seats),
        days_to_renewal = COALESCE(EXCLUDED.days_to_renewal, account_metrics.days_to_renewal),
        days_since_cs_touchpoint = COALESCE(EXCLUDED.days_since_cs_touchpoint, account_metrics.days_since_cs_touchpoint),
        last_updated = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [
      accountId, orgId,
      metrics.dau_7d || 0, metrics.mau_30d || 0, metrics.sessions_7d || 0,
      JSON.stringify(metrics.feature_adoption || {}),
      metrics.support_tickets_30d || 0, metrics.avg_csat_90d || 0,
      metrics.days_since_login || 0, metrics.payment_failures_90d || 0,
      metrics.seat_utilization || 0, metrics.active_seats || 0,
      metrics.licensed_seats || 0, metrics.days_to_renewal || 365,
      metrics.days_since_cs_touchpoint || 0
    ]);
    return result.rows[0];
  }

  static async listByOrg(orgId: string): Promise<AccountMetricsData[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT am.*, a.name as account_name, a.arr, a.health_score, a.churn_probability
       FROM account_metrics am
       JOIN accounts a ON am.account_id = a.id
       WHERE am.org_id = $1
       ORDER BY a.churn_probability DESC`,
      [orgId]
    );
    return result.rows;
  }
}

export class HealthScoreHistoryModel {
  static async record(accountId: string, orgId: string, scores: {
    score: number; engagement: number; utilization: number;
    support: number; financial: number; relationship: number;
  }): Promise<HealthScoreSnapshot> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO health_score_history (id, account_id, org_id, score, engagement, utilization, support, financial, relationship, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, accountId, orgId, scores.score, scores.engagement,
      scores.utilization, scores.support, scores.financial, scores.relationship
    ]);
    return result.rows[0];
  }

  static async getTimeline(accountId: string, days = 90): Promise<HealthScoreSnapshot[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM health_score_history
      WHERE account_id = $1 AND recorded_at > NOW() - INTERVAL '${days} days'
      ORDER BY recorded_at ASC
    `;
    const result = await pool.query(query, [accountId]);
    return result.rows;
  }
}

export class TimelineEventModel {
  static async create(accountId: string, orgId: string, data: {
    event_type: string; title: string; description: string; metadata?: Record<string, any>;
  }): Promise<TimelineEvent> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO timeline_events (id, account_id, org_id, event_type, title, description, metadata, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, accountId, orgId, data.event_type, data.title,
      data.description, JSON.stringify(data.metadata || {})
    ]);
    return result.rows[0];
  }

  static async listByAccount(accountId: string, limit = 50): Promise<TimelineEvent[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM timeline_events WHERE account_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [accountId, limit]
    );
    return result.rows;
  }
}
