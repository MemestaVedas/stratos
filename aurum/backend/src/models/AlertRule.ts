import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface AlertCondition {
  field: string;
  operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte' | 'change_gt' | 'change_lt';
  value: number;
  window_days?: number;
}

export interface AlertChannels {
  email?: boolean;
  slack_webhook?: string;
  in_app?: boolean;
}

export interface AlertRule {
  id: string;
  org_id: string;
  name: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  channels: AlertChannels;
  playbook_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  account_id: string;
  org_id: string;
  triggered_at: Date;
  resolved_at?: Date;
  snoozed_until?: Date;
  resolution_note?: string;
  status: 'active' | 'snoozed' | 'resolved';
}

export interface Playbook {
  id: string;
  org_id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
  created_at: Date;
}

export interface PlaybookStep {
  order: number;
  action: 'notify_rep' | 'notify_manager' | 'schedule_ebr' | 'send_email' | 'slack_alert' | 'create_task';
  config: Record<string, any>;
  delay_hours?: number;
}

export class AlertRuleModel {
  static async create(orgId: string, data: Partial<AlertRule>): Promise<AlertRule> {
    const id = uuidv4();
    const pool = getPool();

    const query = `
      INSERT INTO alert_rules (id, org_id, name, condition, severity, channels, playbook_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      id, orgId, data.name,
      JSON.stringify(data.condition),
      data.severity || 'warning',
      JSON.stringify(data.channels || { in_app: true }),
      data.playbook_id || null,
      data.is_active !== false
    ]);
    return result.rows[0];
  }

  static async listByOrg(orgId: string, activeOnly = false): Promise<AlertRule[]> {
    const pool = getPool();
    let query = `SELECT * FROM alert_rules WHERE org_id = $1`;
    if (activeOnly) query += ` AND is_active = true`;
    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, [orgId]);
    return result.rows;
  }

  static async getById(ruleId: string, orgId: string): Promise<AlertRule | null> {
    const pool = getPool();
    const query = `SELECT * FROM alert_rules WHERE id = $1 AND org_id = $2`;
    const result = await pool.query(query, [ruleId, orgId]);
    return result.rows[0] || null;
  }

  static async update(ruleId: string, orgId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const pool = getPool();
    const query = `
      UPDATE alert_rules
      SET name = COALESCE($1, name),
          condition = COALESCE($2, condition),
          severity = COALESCE($3, severity),
          channels = COALESCE($4, channels),
          playbook_id = COALESCE($5, playbook_id),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $7 AND org_id = $8
      RETURNING *
    `;
    const result = await pool.query(query, [
      updates.name, updates.condition ? JSON.stringify(updates.condition) : null,
      updates.severity, updates.channels ? JSON.stringify(updates.channels) : null,
      updates.playbook_id, updates.is_active, ruleId, orgId
    ]);
    return result.rows[0] || null;
  }

  static async delete(ruleId: string, orgId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM alert_rules WHERE id = $1 AND org_id = $2`, [ruleId, orgId]);
    return result.rowCount! > 0;
  }
}

export class AlertEventModel {
  static async create(ruleId: string, accountId: string, orgId: string): Promise<AlertEvent> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO alert_events (id, rule_id, account_id, org_id, triggered_at, status)
      VALUES ($1, $2, $3, $4, NOW(), 'active')
      RETURNING *
    `;
    const result = await pool.query(query, [id, ruleId, accountId, orgId]);
    return result.rows[0];
  }

  static async listByOrg(orgId: string, status?: string, limit = 50): Promise<AlertEvent[]> {
    const pool = getPool();
    let query = `SELECT ae.*, ar.name as rule_name, ar.severity, a.name as account_name, a.arr
                 FROM alert_events ae
                 JOIN alert_rules ar ON ae.rule_id = ar.id
                 JOIN accounts a ON ae.account_id = a.id
                 WHERE ae.org_id = $1`;
    const params: any[] = [orgId];
    if (status) {
      query += ` AND ae.status = $2`;
      params.push(status);
    }
    query += ` ORDER BY ae.triggered_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async snooze(eventId: string, orgId: string, snoozeDays: number, note?: string): Promise<AlertEvent | null> {
    const pool = getPool();
    const snoozeUntil = new Date(Date.now() + snoozeDays * 86400000);
    const query = `
      UPDATE alert_events
      SET status = 'snoozed', snoozed_until = $1, resolution_note = $2
      WHERE id = $3 AND org_id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [snoozeUntil, note || null, eventId, orgId]);
    return result.rows[0] || null;
  }

  static async resolve(eventId: string, orgId: string, note?: string): Promise<AlertEvent | null> {
    const pool = getPool();
    const query = `
      UPDATE alert_events
      SET status = 'resolved', resolved_at = NOW(), resolution_note = $1
      WHERE id = $2 AND org_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [note || null, eventId, orgId]);
    return result.rows[0] || null;
  }
}

export class PlaybookModel {
  static async create(orgId: string, data: Partial<Playbook>): Promise<Playbook> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO playbooks (id, org_id, name, description, steps, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, orgId, data.name, data.description || '',
      JSON.stringify(data.steps || [])
    ]);
    return result.rows[0];
  }

  static async listByOrg(orgId: string): Promise<Playbook[]> {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM playbooks WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]);
    return result.rows;
  }

  static async getById(playbookId: string, orgId: string): Promise<Playbook | null> {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM playbooks WHERE id = $1 AND org_id = $2`, [playbookId, orgId]);
    return result.rows[0] || null;
  }
}
