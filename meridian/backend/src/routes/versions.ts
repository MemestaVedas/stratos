import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/workflows/:id/versions - List all versions
router.get('/:workflowId/versions', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const query = `
      SELECT wv.*, u.name as deployed_by_name
      FROM workflow_versions wv
      LEFT JOIN users u ON wv.created_by = u.id
      WHERE wv.workflow_id = $1
      ORDER BY wv.version DESC
    `;
    const result = await pool.query(query, [req.params.workflowId]);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    logger.error('Error listing versions:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// GET /api/workflows/:id/versions/:version - Get specific version
router.get('/:workflowId/versions/:version', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const query = `
      SELECT * FROM workflow_versions
      WHERE workflow_id = $1 AND version = $2
    `;
    const result = await pool.query(query, [req.params.workflowId, req.params.version]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Version not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting version:', error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// POST /api/workflows/:id/versions/:version/deploy - Deploy a specific version
router.post('/:workflowId/versions/:version/deploy', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { changelog } = req.body;

    // Get the version
    const versionResult = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2`,
      [req.params.workflowId, req.params.version]
    );
    if (!versionResult.rows[0]) return res.status(404).json({ error: 'Version not found' });

    const version = versionResult.rows[0];

    // Update the workflow to use this version's snapshot
    await pool.query(
      `UPDATE workflows SET
        nodes = $1, edges = $2, status = 'published',
        current_version = $3, updated_at = NOW()
       WHERE id = $4`,
      [version.nodes_snapshot, version.edges_snapshot, version.version, req.params.workflowId]
    );

    logger.info(`Deployed version ${version.version} of workflow ${req.params.workflowId}`);

    res.json({
      status: 'success',
      data: {
        workflow_id: req.params.workflowId,
        deployed_version: version.version,
        changelog: changelog || version.changelog,
        deployed_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    logger.error('Error deploying version:', error);
    res.status(500).json({ error: 'Failed to deploy version' });
  }
});

// POST /api/workflows/:id/rollback - Rollback to the previous version
router.post('/:workflowId/rollback', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Get the current version
    const workflow = await pool.query(
      `SELECT current_version FROM workflows WHERE id = $1`,
      [req.params.workflowId]
    );
    if (!workflow.rows[0]) return res.status(404).json({ error: 'Workflow not found' });

    const currentVersion = workflow.rows[0].current_version || 1;
    if (currentVersion <= 1) {
      return res.status(400).json({ error: 'Cannot rollback — already at version 1' });
    }

    // Get the previous version
    const prevVersion = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2`,
      [req.params.workflowId, currentVersion - 1]
    );
    if (!prevVersion.rows[0]) return res.status(404).json({ error: 'Previous version not found' });

    const prev = prevVersion.rows[0];

    // Rollback
    await pool.query(
      `UPDATE workflows SET
        nodes = $1, edges = $2, current_version = $3, updated_at = NOW()
       WHERE id = $4`,
      [prev.nodes_snapshot, prev.edges_snapshot, prev.version, req.params.workflowId]
    );

    logger.info(`Rolled back workflow ${req.params.workflowId} from v${currentVersion} to v${prev.version}`);

    res.json({
      status: 'success',
      data: {
        workflow_id: req.params.workflowId,
        previous_version: currentVersion,
        rolled_back_to: prev.version,
        rolled_back_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    logger.error('Error rolling back:', error);
    res.status(500).json({ error: 'Failed to rollback' });
  }
});

// GET /api/workflows/:id/versions/diff?v1=1&v2=2 - Diff two versions
router.get('/:workflowId/versions/diff', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const v1 = parseInt(req.query.v1 as string);
    const v2 = parseInt(req.query.v2 as string);

    if (!v1 || !v2) return res.status(400).json({ error: 'v1 and v2 query params required' });

    const result = await pool.query(
      `SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version IN ($2, $3)`,
      [req.params.workflowId, v1, v2]
    );

    if (result.rows.length < 2) return res.status(404).json({ error: 'One or both versions not found' });

    const ver1 = result.rows.find((r: any) => r.version === v1);
    const ver2 = result.rows.find((r: any) => r.version === v2);

    const nodes1 = new Set((ver1.nodes_snapshot || []).map((n: any) => n.id));
    const nodes2 = new Set((ver2.nodes_snapshot || []).map((n: any) => n.id));

    const nodesAdded = [...nodes2].filter(n => !nodes1.has(n));
    const nodesRemoved = [...nodes1].filter(n => !nodes2.has(n));
    const nodesModified = [...nodes1].filter(n => nodes2.has(n)); // simplified

    res.json({
      status: 'success',
      data: {
        v1: { version: v1, node_count: nodes1.size, changelog: ver1.changelog },
        v2: { version: v2, node_count: nodes2.size, changelog: ver2.changelog },
        diff: {
          nodes_added: nodesAdded,
          nodes_removed: nodesRemoved,
          nodes_potentially_modified: nodesModified.length,
          edges_v1: (ver1.edges_snapshot || []).length,
          edges_v2: (ver2.edges_snapshot || []).length,
        }
      }
    });
  } catch (error) {
    logger.error('Error computing diff:', error);
    res.status(500).json({ error: 'Failed to compute diff' });
  }
});

export default router;
