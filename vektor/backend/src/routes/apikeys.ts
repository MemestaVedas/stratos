import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/apikeys - List API keys
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, prefix, permissions, last_used_at, expires_at, is_active, created_at
       FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// POST /api/apikeys - Create API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, permissions, expires_in_days } = req.body;

    if (!name) return res.status(400).json({ error: 'API key name is required' });

    const rawKey = 'vk_' + crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.slice(0, 8);
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
    const id = uuidv4();

    const pool = getPool();
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000)
      : null;

    await pool.query(
      `INSERT INTO api_keys (id, org_id, name, key_hash, prefix, permissions, is_active, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW())`,
      [id, orgId, name, hashedKey, prefix, JSON.stringify(permissions || ['query', 'ingest']), expiresAt]
    );

    // Return the raw key ONLY on creation (never stored or returned again)
    res.status(201).json({
      status: 'success',
      data: {
        id,
        name,
        key: rawKey, // Only returned once!
        prefix,
        permissions: permissions || ['query', 'ingest'],
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
      warning: 'This API key will only be shown once. Please save it securely.',
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// DELETE /api/apikeys/:id - Revoke API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const pool = getPool();
    const result = await pool.query(
      `UPDATE api_keys SET is_active = false WHERE id = $1 AND org_id = $2 RETURNING id`,
      [req.params.id, orgId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'API key not found' });
    res.json({ status: 'success', message: 'API key revoked' });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
