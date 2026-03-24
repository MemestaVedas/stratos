import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'llm_call' | 'code_executor' | 'http_request' | 'data_transform' | 'conditional' | 'human_approval' | 'sub_workflow' | 'aggregator' | 'delay';
  label: string;
  config: Record<string, any>;
  inputs?: string[];
  outputs?: Record<string, any>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  change_summary: string;
  created_at: Date;
}

export class WorkflowModel {
  static async create(workspaceId: string, name: string, description: string): Promise<Workflow> {
    const id = uuidv4();
    const pool = getPool();
    
    const query = `
      INSERT INTO workflows (id, workspace_id, name, description, nodes, edges, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, workspaceId, name, description, JSON.stringify([]), JSON.stringify([])]);
    return result.rows[0];
  }

  static async getByIdAndWorkspace(workflowId: string, workspaceId: string): Promise<Workflow | null> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM workflows 
      WHERE id = $1 AND workspace_id = $2
    `;
    
    const result = await pool.query(query, [workflowId, workspaceId]);
    return result.rows[0] || null;
  }

  static async listByWorkspace(workspaceId: string, limit = 50, offset = 0): Promise<Workflow[]> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM workflows 
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [workspaceId, limit, offset]);
    return result.rows;
  }

  static async update(workflowId: string, workspaceId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const pool = getPool();
    const id = uuidv4();
    
    // Create new version
    const versionQuery = `
      INSERT INTO workflow_versions (id, workflow_id, version, nodes, edges, change_summary, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    await pool.query(versionQuery, [
      id, 
      workflowId,
      new Date().toISOString(),
      JSON.stringify(updates.nodes || []),
      JSON.stringify(updates.edges || []),
      'Manual update'
    ]);
    
    // Update workflow
    const updateQuery = `
      UPDATE workflows 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          nodes = COALESCE($3, nodes),
          edges = COALESCE($4, edges),
          updated_at = NOW()
      WHERE id = $5 AND workspace_id = $6
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [
      updates.name,
      updates.description,
      JSON.stringify(updates.nodes || []),
      JSON.stringify(updates.edges || []),
      workflowId,
      workspaceId
    ]);
    
    return result.rows[0];
  }

  static async delete(workflowId: string, workspaceId: string): Promise<boolean> {
    const pool = getPool();
    
    const query = `
      DELETE FROM workflows 
      WHERE id = $1 AND workspace_id = $2
    `;
    
    const result = await pool.query(query, [workflowId, workspaceId]);
    return result.rowCount! > 0;
  }
}
