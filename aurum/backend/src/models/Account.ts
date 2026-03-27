import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface Account {
  id: string;
  org_id: string;
  external_id?: string;
  name: string;
  arr: number;
  mrr: number;
  plan: string;
  contract_start?: Date;
  contract_end?: Date;
  health_score: number;
  churn_probability: number;
  churn_risk_tier: 'healthy' | 'at_risk' | 'high_risk' | 'churned';
  owner_user_id?: string;
  lifecycle_stage: string;
  industry?: string;
  employee_count?: number;
  created_at: Date;
  updated_at: Date;
}

export interface HealthScore {
  account_id: string;
  score: number;
  components: {
    engagement: number;
    utilization: number;
    support: number;
    financial: number;
    relationship: number;
  };
  trend: number;
  updated_at: Date;
}

export class AccountModel {
  static async create(orgId: string, name: string, arr: number, data?: Partial<Account>): Promise<Account> {
    const id = uuidv4();
    const pool = getPool();

    const query = `
      INSERT INTO accounts (id, org_id, external_id, name, arr, mrr, plan, contract_start, contract_end,
        health_score, churn_probability, churn_risk_tier, owner_user_id, lifecycle_stage, industry,
        employee_count, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      id, orgId, data?.external_id || null, name, arr,
      Math.round(arr / 12), data?.plan || 'professional',
      data?.contract_start || null, data?.contract_end || null,
      75, 0.15, 'healthy', data?.owner_user_id || null,
      data?.lifecycle_stage || 'active', data?.industry || null,
      data?.employee_count || null
    ]);
    return result.rows[0];
  }

  static async getByIdAndOrg(accountId: string, orgId: string): Promise<Account | null> {
    const pool = getPool();
    const query = `SELECT * FROM accounts WHERE id = $1 AND org_id = $2`;
    const result = await pool.query(query, [accountId, orgId]);
    return result.rows[0] || null;
  }

  static async listByOrg(orgId: string, filters?: {
    limit?: number;
    offset?: number;
    health_score_min?: number;
    health_score_max?: number;
    churn_probability_min?: number;
    risk_tier?: string;
    plan?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<{ accounts: Account[]; total: number }> {
    const pool = getPool();
    const conditions: string[] = ['org_id = $1'];
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (filters?.health_score_min !== undefined) {
      conditions.push(`health_score >= $${paramIdx++}`);
      params.push(filters.health_score_min);
    }
    if (filters?.health_score_max !== undefined) {
      conditions.push(`health_score <= $${paramIdx++}`);
      params.push(filters.health_score_max);
    }
    if (filters?.churn_probability_min !== undefined) {
      conditions.push(`churn_probability >= $${paramIdx++}`);
      params.push(filters.churn_probability_min);
    }
    if (filters?.risk_tier) {
      conditions.push(`churn_risk_tier = $${paramIdx++}`);
      params.push(filters.risk_tier);
    }
    if (filters?.plan) {
      conditions.push(`plan = $${paramIdx++}`);
      params.push(filters.plan);
    }

    const where = conditions.join(' AND ');
    const sortBy = filters?.sort_by || 'churn_probability';
    const sortOrder = filters?.sort_order === 'ASC' ? 'ASC' : 'DESC';
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const countResult = await pool.query(`SELECT COUNT(*) FROM accounts WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT * FROM accounts WHERE ${where}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return { accounts: result.rows, total };
  }

  static async update(accountId: string, orgId: string, updates: Partial<Account>): Promise<Account | null> {
    const pool = getPool();
    const query = `
      UPDATE accounts
      SET name = COALESCE($1, name),
          arr = COALESCE($2, arr),
          mrr = COALESCE($3, mrr),
          plan = COALESCE($4, plan),
          contract_end = COALESCE($5, contract_end),
          owner_user_id = COALESCE($6, owner_user_id),
          lifecycle_stage = COALESCE($7, lifecycle_stage),
          updated_at = NOW()
      WHERE id = $8 AND org_id = $9
      RETURNING *
    `;
    const result = await pool.query(query, [
      updates.name, updates.arr, updates.mrr || (updates.arr ? Math.round(updates.arr / 12) : null),
      updates.plan, updates.contract_end, updates.owner_user_id,
      updates.lifecycle_stage, accountId, orgId
    ]);
    return result.rows[0] || null;
  }

  static async updateHealthScore(accountId: string, score: number, churnProb: number, riskTier: string): Promise<void> {
    const pool = getPool();
    const query = `
      UPDATE accounts
      SET health_score = $1, churn_probability = $2, churn_risk_tier = $3, updated_at = NOW()
      WHERE id = $4
    `;
    await pool.query(query, [score, churnProb, riskTier, accountId]);
  }

  static async getAtRiskAccounts(orgId: string, limit = 10): Promise<Account[]> {
    const pool = getPool();
    const query = `
      SELECT * FROM accounts
      WHERE org_id = $1 AND churn_risk_tier IN ('at_risk', 'high_risk')
      ORDER BY (churn_probability * arr) DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [orgId, limit]);
    return result.rows;
  }

  static async getAggregateMetrics(orgId: string): Promise<any> {
    const pool = getPool();
    const query = `
      SELECT
        COUNT(*) as total_accounts,
        COALESCE(SUM(arr), 0) as total_arr,
        COALESCE(SUM(mrr), 0) as total_mrr,
        COALESCE(AVG(health_score), 0) as avg_health_score,
        COUNT(CASE WHEN churn_risk_tier = 'healthy' THEN 1 END) as healthy_count,
        COUNT(CASE WHEN churn_risk_tier = 'at_risk' THEN 1 END) as at_risk_count,
        COUNT(CASE WHEN churn_risk_tier = 'high_risk' THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN churn_risk_tier = 'churned' THEN 1 END) as churned_count,
        COALESCE(SUM(CASE WHEN churn_risk_tier = 'healthy' THEN arr ELSE 0 END), 0) as healthy_arr,
        COALESCE(SUM(CASE WHEN churn_risk_tier = 'at_risk' THEN arr ELSE 0 END), 0) as at_risk_arr,
        COALESCE(SUM(CASE WHEN churn_risk_tier = 'high_risk' THEN arr ELSE 0 END), 0) as high_risk_arr
      FROM accounts WHERE org_id = $1
    `;
    const result = await pool.query(query, [orgId]);
    return result.rows[0];
  }
}
