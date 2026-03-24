import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface Index {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  embedding_model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'embed-english-v3.0' | 'nomic-embed-text';
  chunk_size: number;
  chunk_overlap: number;
  distance_metric: 'cosine' | 'euclidean' | 'dot_product';
  status: 'EMPTY' | 'BUILDING' | 'READY' | 'DEGRADED';
  total_chunks: number;
  total_tokens: number;
  last_updated: Date;
  created_at: Date;
}

export interface Chunk {
  id: string;
  index_id: string;
  document_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: Date;
}

export class IndexModel {
  static async create(
    workspaceId: string,
    name: string,
    description: string,
    embeddingModel: string,
    chunkSize: number,
    chunkOverlap: number
  ): Promise<Index> {
    const id = uuidv4();
    const pool = getPool();
    
    const query = `
      INSERT INTO indexes (id, workspace_id, name, description, embedding_model, chunk_size, chunk_overlap, status, total_chunks, total_tokens, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'EMPTY', 0, 0, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [id, workspaceId, name, description, embeddingModel, chunkSize, chunkOverlap]);
    return result.rows[0];
  }

  static async getByIdAndWorkspace(indexId: string, workspaceId: string): Promise<Index | null> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM indexes 
      WHERE id = $1 AND workspace_id = $2
    `;
    
    const result = await pool.query(query, [indexId, workspaceId]);
    return result.rows[0] || null;
  }

  static async listByWorkspace(workspaceId: string, limit = 50): Promise<Index[]> {
    const pool = getPool();
    
    const query = `
      SELECT * FROM indexes 
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [workspaceId, limit]);
    return result.rows;
  }

  static async updateStatus(indexId: string, status: string): Promise<void> {
    const pool = getPool();
    
    const query = `
      UPDATE indexes 
      SET status = $1, last_updated = NOW()
      WHERE id = $2
    `;
    
    await pool.query(query, [status, indexId]);
  }

  static async delete(indexId: string, workspaceId: string): Promise<boolean> {
    const pool = getPool();
    
    const query = `
      DELETE FROM indexes 
      WHERE id = $1 AND workspace_id = $2
    `;
    
    const result = await pool.query(query, [indexId, workspaceId]);
    return result.rowCount! > 0;
  }
}
