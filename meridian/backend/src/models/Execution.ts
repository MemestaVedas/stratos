import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type NodeExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface NodeExecutionResult {
  node_id: string;
  node_type: string;
  status: NodeExecutionStatus;
  input?: any;
  output?: any;
  error?: string;
  started_at?: Date;
  completed_at?: Date;
  duration_ms: number;
  tokens_used?: { prompt: number; completion: number; total: number; cost_usd: number };
  retries: number;
}

export interface Execution {
  id: string;
  workflow_id: string;
  org_id: string;
  workspace_id: string;
  version_id?: string;
  status: ExecutionStatus;
  trigger_source: 'manual' | 'webhook' | 'schedule' | 'api';
  input_data?: any;
  output_data?: any;
  node_results: NodeExecutionResult[];
  error?: string;
  started_at: Date;
  completed_at?: Date;
  duration_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  created_at: Date;
}

export class ExecutionModel {
  static async create(workflowId: string, orgId: string, wsId: string, data: {
    trigger_source: string;
    input_data?: any;
    version_id?: string;
  }): Promise<Execution> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO executions (id, workflow_id, org_id, workspace_id, version_id, status,
        trigger_source, input_data, node_results, started_at, duration_ms,
        total_tokens, total_cost_usd, created_at)
      VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, '[]'::jsonb, NOW(), 0, 0, 0, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, workflowId, orgId, wsId, data.version_id || null,
      data.trigger_source, JSON.stringify(data.input_data || {})
    ]);
    return result.rows[0];
  }

  static async getById(execId: string, orgId: string): Promise<Execution | null> {
    const pool = getPool();
    const query = `
      SELECT e.*, w.name as workflow_name
      FROM executions e
      LEFT JOIN workflows w ON e.workflow_id = w.id
      WHERE e.id = $1 AND e.org_id = $2
    `;
    const result = await pool.query(query, [execId, orgId]);
    return result.rows[0] || null;
  }

  static async listByWorkflow(workflowId: string, orgId: string, filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ executions: Execution[]; total: number }> {
    const pool = getPool();
    const conditions = ['workflow_id = $1', 'org_id = $2'];
    const params: any[] = [workflowId, orgId];
    let paramIdx = 3;

    if (filters?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filters.status);
    }

    const where = conditions.join(' AND ');
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await pool.query(`SELECT COUNT(*) FROM executions WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const query = `SELECT * FROM executions WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const result = await pool.query(query, params);

    return { executions: result.rows, total };
  }

  static async listByOrg(orgId: string, limit = 50): Promise<Execution[]> {
    const pool = getPool();
    const query = `
      SELECT e.*, w.name as workflow_name
      FROM executions e
      LEFT JOIN workflows w ON e.workflow_id = w.id
      WHERE e.org_id = $1
      ORDER BY e.created_at DESC LIMIT $2
    `;
    const result = await pool.query(query, [orgId, limit]);
    return result.rows;
  }

  static async updateStatus(execId: string, status: ExecutionStatus, data?: {
    node_results?: NodeExecutionResult[];
    output_data?: any;
    error?: string;
    duration_ms?: number;
    total_tokens?: number;
    total_cost_usd?: number;
  }): Promise<Execution | null> {
    const pool = getPool();
    const query = `
      UPDATE executions SET
        status = $1,
        node_results = COALESCE($2, node_results),
        output_data = COALESCE($3, output_data),
        error = COALESCE($4, error),
        duration_ms = COALESCE($5, duration_ms),
        total_tokens = COALESCE($6, total_tokens),
        total_cost_usd = COALESCE($7, total_cost_usd),
        completed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled', 'timeout') THEN NOW() ELSE completed_at END
      WHERE id = $8
      RETURNING *
    `;
    const result = await pool.query(query, [
      status,
      data?.node_results ? JSON.stringify(data.node_results) : null,
      data?.output_data ? JSON.stringify(data.output_data) : null,
      data?.error || null,
      data?.duration_ms || null,
      data?.total_tokens || null,
      data?.total_cost_usd || null,
      execId
    ]);
    return result.rows[0] || null;
  }

  static async cancel(execId: string, orgId: string): Promise<Execution | null> {
    const pool = getPool();
    const query = `
      UPDATE executions
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = $1 AND org_id = $2 AND status IN ('queued', 'running')
      RETURNING *
    `;
    const result = await pool.query(query, [execId, orgId]);
    return result.rows[0] || null;
  }

  static async getMetrics(orgId: string): Promise<any> {
    const pool = getPool();
    const query = `
      SELECT
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
        COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued,
        AVG(CASE WHEN status = 'completed' THEN duration_ms END) as avg_duration_ms,
        SUM(total_tokens) as total_tokens_used,
        SUM(total_cost_usd) as total_cost_usd,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate
      FROM executions WHERE org_id = $1
    `;
    const result = await pool.query(query, [orgId]);
    return result.rows[0];
  }
}
