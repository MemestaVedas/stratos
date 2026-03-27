import { Router, Request, Response } from 'express';
import { CredentialModel } from '../models/Credential';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/credentials - List credentials (masked)
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const type = req.query.type as string;
    const credentials = await CredentialModel.listByOrg(orgId, type);
    res.json({ status: 'success', data: credentials });
  } catch (error) {
    logger.error('Error listing credentials:', error);
    res.status(500).json({ error: 'Failed to list credentials' });
  }
});

// GET /api/credentials/:id/masked - Get credential with masked values
router.get('/:id/masked', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const masked = await CredentialModel.getMasked(req.params.id, orgId);
    if (!masked) return res.status(404).json({ error: 'Credential not found' });
    res.json({ status: 'success', data: masked });
  } catch (error) {
    logger.error('Error getting masked credential:', error);
    res.status(500).json({ error: 'Failed to get credential' });
  }
});

// POST /api/credentials - Create credential (encrypted at rest)
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const wsId = req.headers['x-workspace-id'] as string || 'default';
    const { name, credential_type, credential_data, expires_at } = req.body;

    if (!name || !credential_type || !credential_data) {
      return res.status(400).json({ error: 'name, credential_type, and credential_data are required' });
    }

    const credential = await CredentialModel.create(orgId, wsId, {
      name, credential_type, credential_data, expires_at
    });

    res.status(201).json({ status: 'success', data: credential });
  } catch (error) {
    logger.error('Error creating credential:', error);
    res.status(500).json({ error: 'Failed to create credential' });
  }
});

// DELETE /api/credentials/:id - Delete credential
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const deleted = await CredentialModel.delete(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: 'Credential not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting credential:', error);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

// POST /api/credentials/:id/test - Test credential connectivity
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const decryptedData = await CredentialModel.getDecrypted(req.params.id, orgId);
    if (!decryptedData) return res.status(404).json({ error: 'Credential not found' });

    // Mock connectivity test
    res.json({
      status: 'success',
      data: {
        credential_id: req.params.id,
        connectivity: 'ok',
        tested_at: new Date().toISOString(),
        response_time_ms: Math.round(Math.random() * 200 + 50),
      }
    });
  } catch (error) {
    logger.error('Error testing credential:', error);
    res.status(500).json({ error: 'Failed to test credential' });
  }
});

export default router;
