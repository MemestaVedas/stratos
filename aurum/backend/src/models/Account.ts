import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface Account {
  id: string;
  org_id: string;
  name: string;
  arr: number;
  health_score: number;
  churn_probability: number;
  created_at: Date;
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
  static async create(orgId: string, name: string, arr: number): Promise<Account> {
    const id = uuidv4();
    const pool = getPool();
    
    const query = `
      INSERT INTO accounts (id, org_id, name, arr, health_score, churn_probability, created_at)
      VALUES ($1, $2, $3, $4, 75, 0.15, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, orgId, name, arr]);
    return result.rows[0];
  }

  static async getByIdAndOrg(accountId: string, orgId: string): Promise<Account | null> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM accounts 
      WHERE id = $1 AND org_id = $2
    `;
    
    const result = await pool.query(query, [accountId, orgId]);
    return result.rows[0] || null;
  }

  static async listByOrg(orgId: string, limit = 100): Promise<Account[]> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM accounts 
      WHERE org_id = $1
      ORDER BY churn_probability DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [orgId, limit]);
    return result.rows;
  }

  static async updateHealthScore(accountId: string, score: number, components: any): Promise<void> {
    const pool = getPool();
    
    const query = `
      UPDATE accounts 
      SET health_score = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await pool.query(query, [score, accountId]);
  }
}
