import { Router, Request, Response } from 'express';
import { AccountModel } from '../models/Account';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/accounts - List accounts
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const accounts = await AccountModel.listByOrg(orgId);
    res.json({ data: accounts, count: accounts.length });
  } catch (error) {
    logger.error('Error listing accounts:', error);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

// GET /api/accounts/:id - Get account details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const account = await AccountModel.getByIdAndOrg(req.params.id, orgId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    logger.error('Error getting account:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// POST /api/accounts - Create account
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const { name, arr } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Account name is required' });
    }
    
    const account = await AccountModel.create(orgId, name, arr || 0);
    res.status(201).json(account);
  } catch (error) {
    logger.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

export default router;
