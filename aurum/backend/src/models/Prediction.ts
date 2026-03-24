import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface ChurnPrediction {
  id: string;
  account_id: string;
  churn_probability: number;
  risk_tier: 'LOW' | 'MEDIUM' | 'HIGH';
  feature_snapshot: Record<string, any>;
  shap_values: Record<string, number>;
  model_version: string;
  created_at: Date;
}

export class PredictionModel {
  static async create(
    accountId: string,
    churnProbability: number,
    shap: Record<string, number>,
    features: Record<string, any>
  ): Promise<ChurnPrediction> {
    const id = uuidv4();
    const pool = getPool();
    
    const riskTier = churnProbability > 0.7 ? 'HIGH' : churnProbability > 0.4 ? 'MEDIUM' : 'LOW';
    
    const query = `
      INSERT INTO churn_predictions (id, account_id, churn_probability, risk_tier, feature_snapshot, shap_values, model_version, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      id,
      accountId,
      churnProbability,
      riskTier,
      JSON.stringify(features),
      JSON.stringify(shap),
      'v1'
    ]);
    
    return result.rows[0];
  }

  static async getLatestByAccount(accountId: string): Promise<ChurnPrediction | null> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM churn_predictions 
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [accountId]);
    return result.rows[0] || null;
  }
}
