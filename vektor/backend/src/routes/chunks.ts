import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/indexes/:indexId/chunks - List chunks
router.get('/:indexId/chunks', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const sourceType = req.query.source_type as string;

    let query = `SELECT id, content, source_id, source_type, chunk_number, metadata, created_at
                 FROM chunks WHERE index_id = $1 AND org_id = $2`;
    const params: any[] = [req.params.indexId, orgId];

    if (sourceType) {
      query += ` AND source_type = $3`;
      params.push(sourceType);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM chunks WHERE index_id = $1 AND org_id = $2`,
      [req.params.indexId, orgId]
    );

    res.json({
      status: 'success',
      data: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), limit, offset },
    });
  } catch (error) {
    logger.error('Error listing chunks:', error);
    res.status(500).json({ error: 'Failed to list chunks' });
  }
});

// DELETE /api/chunks/:chunkId - Delete a chunk
router.delete('/chunks/:chunkId', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM chunks WHERE id = $1 AND org_id = $2`,
      [req.params.chunkId, orgId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Chunk not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting chunk:', error);
    res.status(500).json({ error: 'Failed to delete chunk' });
  }
});

export default router;
