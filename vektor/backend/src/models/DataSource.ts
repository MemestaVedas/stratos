import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';

export interface DataSource {
  id: string;
  index_id: string;
  org_id: string;
  name: string;
  source_type: 'github' | 'confluence' | 'slack' | 'postgresql' | 'web_crawler' | 'file_upload' | 's3' | 'gcs' | 'notion' | 'google_drive' | 'custom_api';
  connector_config: Record<string, any>;
  ingest_schedule?: string; // cron expression
  ingestion_status: 'idle' | 'running' | 'completed' | 'failed';
  last_ingestion_at?: Date;
  next_ingestion_at?: Date;
  total_documents: number;
  total_chunks: number;
  created_at: Date;
  updated_at: Date;
}

export class DataSourceModel {
  static async create(indexId: string, orgId: string, data: Partial<DataSource>): Promise<DataSource> {
    const id = uuidv4();
    const pool = getPool();

    const query = `
      INSERT INTO data_sources (id, index_id, org_id, name, source_type, connector_config,
        ingest_schedule, ingestion_status, total_documents, total_chunks, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'idle', 0, 0, NOW(), NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, indexId, orgId, data.name, data.source_type || 'file_upload',
      JSON.stringify(data.connector_config || {}),
      data.ingest_schedule || null
    ]);
    return result.rows[0];
  }

  static async listByIndex(indexId: string, orgId: string): Promise<DataSource[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM data_sources WHERE index_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [indexId, orgId]
    );
    return result.rows;
  }

  static async getById(dsId: string, orgId: string): Promise<DataSource | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM data_sources WHERE id = $1 AND org_id = $2`,
      [dsId, orgId]
    );
    return result.rows[0] || null;
  }

  static async updateStatus(dsId: string, status: string, stats?: {
    total_documents?: number; total_chunks?: number;
  }): Promise<DataSource | null> {
    const pool = getPool();
    const query = `
      UPDATE data_sources SET
        ingestion_status = $1,
        last_ingestion_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE last_ingestion_at END,
        total_documents = COALESCE($2, total_documents),
        total_chunks = COALESCE($3, total_chunks),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [
      status, stats?.total_documents || null, stats?.total_chunks || null, dsId
    ]);
    return result.rows[0] || null;
  }

  static async delete(dsId: string, orgId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM data_sources WHERE id = $1 AND org_id = $2`,
      [dsId, orgId]
    );
    return result.rowCount! > 0;
  }
}

export interface SyncJob {
  id: string;
  datasource_id: string;
  org_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-1
  documents_processed: number;
  chunks_created: number;
  errors: any[];
  started_at: Date;
  completed_at?: Date;
}

export class SyncJobModel {
  static async create(dsId: string, orgId: string): Promise<SyncJob> {
    const id = uuidv4();
    const pool = getPool();
    const query = `
      INSERT INTO sync_jobs (id, datasource_id, org_id, status, progress,
        documents_processed, chunks_created, errors, started_at)
      VALUES ($1, $2, $3, 'queued', 0, 0, 0, '[]'::jsonb, NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [id, dsId, orgId]);
    return result.rows[0];
  }

  static async updateProgress(jobId: string, progress: number, stats: {
    documents_processed: number; chunks_created: number;
  }): Promise<SyncJob | null> {
    const pool = getPool();
    const query = `
      UPDATE sync_jobs SET
        status = CASE WHEN $1 >= 1.0 THEN 'completed' ELSE 'running' END,
        progress = $1,
        documents_processed = $2,
        chunks_created = $3,
        completed_at = CASE WHEN $1 >= 1.0 THEN NOW() ELSE NULL END
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [
      progress, stats.documents_processed, stats.chunks_created, jobId
    ]);
    return result.rows[0] || null;
  }

  static async getById(jobId: string): Promise<SyncJob | null> {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM sync_jobs WHERE id = $1`, [jobId]);
    return result.rows[0] || null;
  }

  static async listByDataSource(dsId: string, limit = 10): Promise<SyncJob[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM sync_jobs WHERE datasource_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [dsId, limit]
    );
    return result.rows;
  }

  static async fail(jobId: string, error: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE sync_jobs SET status = 'failed', errors = errors || $1::jsonb, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify([{ message: error, timestamp: new Date().toISOString() }]), jobId]
    );
  }
}
