import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';
import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY = process.env.CREDENTIAL_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(KEY, 'hex').subarray(0, 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), tag };
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = Buffer.from(KEY, 'hex').subarray(0, 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface Credential {
  id: string;
  org_id: string;
  workspace_id: string;
  name: string;
  credential_type: 'openai' | 'anthropic' | 'google' | 'stripe' | 'github' | 'custom';
  credential_data_encrypted: string;
  iv: string;
  auth_tag: string;
  last_used_at?: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class CredentialModel {
  static async create(orgId: string, wsId: string, data: {
    name: string; credential_type: string; credential_data: Record<string, string>;
    expires_at?: Date;
  }): Promise<Omit<Credential, 'credential_data_encrypted' | 'iv' | 'auth_tag'>> {
    const id = uuidv4();
    const pool = getPool();
    const { encrypted, iv, tag } = encrypt(JSON.stringify(data.credential_data));

    const query = `
      INSERT INTO credentials (id, org_id, workspace_id, name, credential_type,
        credential_data_encrypted, iv, auth_tag, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id, org_id, workspace_id, name, credential_type, last_used_at, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [
      id, orgId, wsId, data.name, data.credential_type,
      encrypted, iv, tag, data.expires_at || null
    ]);
    return result.rows[0];
  }

  static async listByOrg(orgId: string, type?: string): Promise<any[]> {
    const pool = getPool();
    let query = `SELECT id, org_id, workspace_id, name, credential_type, last_used_at, expires_at, created_at
                 FROM credentials WHERE org_id = $1`;
    const params: any[] = [orgId];
    if (type) {
      query += ` AND credential_type = $2`;
      params.push(type);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getDecrypted(credId: string, orgId: string): Promise<Record<string, string> | null> {
    const pool = getPool();
    const query = `SELECT credential_data_encrypted, iv, auth_tag FROM credentials WHERE id = $1 AND org_id = $2`;
    const result = await pool.query(query, [credId, orgId]);
    if (!result.rows[0]) return null;

    try {
      const decrypted = decrypt(result.rows[0].credential_data_encrypted, result.rows[0].iv, result.rows[0].auth_tag);
      // Update last_used_at
      await pool.query(`UPDATE credentials SET last_used_at = NOW() WHERE id = $1`, [credId]);
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  }

  static async delete(credId: string, orgId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM credentials WHERE id = $1 AND org_id = $2`, [credId, orgId]);
    return result.rowCount! > 0;
  }

  static async getMasked(credId: string, orgId: string): Promise<any> {
    const pool = getPool();
    const query = `SELECT credential_data_encrypted, iv, auth_tag, name, credential_type FROM credentials WHERE id = $1 AND org_id = $2`;
    const result = await pool.query(query, [credId, orgId]);
    if (!result.rows[0]) return null;

    try {
      const decrypted = decrypt(result.rows[0].credential_data_encrypted, result.rows[0].iv, result.rows[0].auth_tag);
      const data = JSON.parse(decrypted);
      // Mask secrets: show only first and last 4 chars
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        const v = value as string;
        if (v.length > 8) {
          masked[key] = v.slice(0, 4) + '****' + v.slice(-4);
        } else {
          masked[key] = '****';
        }
      }
      return { name: result.rows[0].name, type: result.rows[0].credential_type, masked_data: masked };
    } catch {
      return null;
    }
  }
}
