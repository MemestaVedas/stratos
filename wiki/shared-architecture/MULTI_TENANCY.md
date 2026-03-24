# Multi-Tenancy & Data Isolation

## Tenant Hierarchy

```
Stratos Platform
├── Organization (Enterprise customer, billing unit)
│   ├── Workspaces (Teams within organization)
│   │   ├── Resources (Workflows, Indexes, Accounts)
│   │   └── Members (With role-based access)
│   ├── Billing & Subscriptions
│   └── Settings
└── (Independent orgs with complete isolation)
```

### Terminology

- **Organization**: Legal entity, billing boundary
- **Workspace**: Team or project within an org (e.g., "Production", "Testing")
- **Resource**: Meridian workflow, Vektor index, Aurum account
- **Member**: User with role-based access to workspace

## Data Isolation Principles

### 1. Database-Level Isolation

Every table includes tenant columns:

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,           -- ← Primary tenant identifier
  workspace_id UUID NOT NULL,     -- ← Secondary tenant identifier
  name VARCHAR(255),
  definition JSONB,
  created_by UUID,
  created_at TIMESTAMP
);

-- Indexes for fast tenant-scoped queries
CREATE INDEX idx_workflows_org_workspace 
  ON workflows(org_id, workspace_id);
```

**Query Pattern** (always include org_id):

```typescript
async function getWorkflow(orgId: string, workspaceId: string, workflowId: string) {
  return db.query(`
    SELECT * FROM workflows
    WHERE org_id = $1 AND workspace_id = $2 AND id = $3
  `, [orgId, workspaceId, workflowId]);
}
```

### 2. Row-Level Security (RLS) with PostgreSQL

Enable RLS policies for defense-in-depth:

```sql
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_org_isolation ON workflows
  USING (org_id = current_setting('app.org_id')::uuid);

-- Set org_id at session level
SET app.org_id = 'org_acme';
```

### 3. Application-Level Enforcement

Every request must validate tenant membership:

```typescript
// Middleware: Extract and validate tenant
const tenantMiddleware = async (req: Request, res: Response, next) => {
  const token = extractJWT(req);
  const { org_id, workspace_id } = token;
  
  // Verify workspace belongs to org
  const workspace = await getWorkspace(workspace_id);
  if (workspace.org_id !== org_id) {
    throw new ForbiddenError('Workspace not in organization');
  }
  
  // Attach to request
  req.tenant = { org_id, workspace_id };
  next();
};

// Usage in route handler
router.get('/api/workflows/:id', tenantMiddleware, async (req, res) => {
  const workflow = await getWorkflow(
    req.tenant.org_id,
    req.tenant.workspace_id,
    req.params.id
  );
  
  res.json(workflow);
});
```

### 4. Credential Encryption

Sensitive data (API keys, OAuth tokens) encrypted at rest:

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;

function encryptCredential(plaintext: string, orgId: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Store: org_id:iv:encrypted:authTag for key derivation
  return `${orgId}:${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decryptCredential(ciphertext: string, orgId: string): string {
  const [storedOrgId, ivHex, encrypted, authTagHex] = ciphertext.split(':');
  
  if (storedOrgId !== orgId) {
    throw new Error('Credential org_id mismatch');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Usage**:

```typescript
// Storing credential
const encrypted = encryptCredential(apiKey, orgId);
await db.query(
  'INSERT INTO credentials VALUES ($1, $2, $3)',
  [uuidv4(), orgId, encrypted]
);

// Retrieving credential
const row = await db.query(
  'SELECT encrypted FROM credentials WHERE org_id = $1',
  [orgId]
);
const apiKey = decryptCredential(row.encrypted, orgId);
```

## Authorization Model

### Role-Based Access Control (RBAC)

Four roles per workspace:

| Role | Meridian | Vektor | Aurum |
|------|----------|--------|-------|
| **Org Owner** | Create workspaces, manage users, view all | Same | Same |
| **Admin** | Create/publish/execute/delete | Create/manage indexes | Manage accounts, view all |
| **Editor** | Create/publish/execute | Create/manage indexes | Query only |
| **Viewer** | View only | View only | View only |

### Permission Checks

```typescript
// Define permissions
const PERMISSIONS = {
  'workflow:read': ['viewer', 'editor', 'admin', 'org_owner'],
  'workflow:write': ['editor', 'admin', 'org_owner'],
  'workflow:execute': ['editor', 'admin', 'org_owner'],
  'workflow:delete': ['admin', 'org_owner'],
  
  'index:read': ['viewer', 'editor', 'admin', 'org_owner'],
  'index:write': ['editor', 'admin', 'org_owner'],
  'index:ingest': ['editor', 'admin', 'org_owner'],
  
  'account:read': ['viewer', 'admin', 'org_owner'],
  'account:write': ['admin', 'org_owner'],
  'event:ingest': ['editor', 'admin', 'org_owner']
};

// Middleware
const authorize = (requiredPermission: string) => {
  return async (req: Request, res: Response, next) => {
    const role = req.jwt.role;
    
    if (!PERMISSIONS[requiredPermission].includes(role)) {
      throw new ForbiddenError(`Requires: ${requiredPermission}`);
    }
    
    next();
  };
};

// Usage
router.post('/api/workflows', 
  authorize('workflow:write'),
  async (req, res) => {
    // Only editors+ can reach here
  }
);
```

## Workspace Membership

### Inviting Users

```typescript
// 1. Generate invitation link with code
const invitation = {
  id: uuidv4(),
  org_id: orgId,
  workspace_id: workspaceId,
  email: 'newuser@acme.com',
  role: 'editor',
  code: crypto.randomBytes(32).toString('hex'),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
};

await db.query(
  'INSERT INTO workspace_invitations VALUES ($1, $2, $3, $4, $5, $6, $7)',
  [invitation.id, invitation.org_id, invitation.workspace_id, 
   invitation.email, invitation.role, invitation.code, invitation.expires_at]
);

// 2. Send email with invite link
await sendEmail(
  invitation.email,
  `Join ${workspace.name}`,
  `https://stratos.dev/invite/${invitation.code}`
);

// 3. User accepts invite
const code = req.query.code;
const inv = await getInvitationByCode(code);

if (inv.expires_at < new Date()) {
  throw new ExpiredError('Invitation expired');
}

// Add user to workspace
const user = getCurrentUser();
await db.query(
  'INSERT INTO workspace_members (org_id, workspace_id, user_id, role) VALUES ($1, $2, $3, $4)',
  [inv.org_id, inv.workspace_id, user.id, inv.role]
);

// Mark accepted
await db.query(
  'UPDATE workspace_invitations SET accepted_at = NOW() WHERE id = $1',
  [inv.id]
);
```

## Resource Quotas

Different orgs have different subscription tiers:

```typescript
interface OrgQuotas {
  meridian_workflows_max: number;
  meridian_executions_per_day: number;
  vektor_indexes_max: number;
  vektor_documents_max: number;
  aurum_accounts_max: number;
  workspace_members_max: number;
  storage_gb: number;
}

const TIER_QUOTAS = {
  'free': {
    meridian_workflows_max: 5,
    meridian_executions_per_day: 100,
    vektor_indexes_max: 1,
    vektor_documents_max: 10000,
    aurum_accounts_max: 500,
    workspace_members_max: 3,
    storage_gb: 1
  },
  'pro': {
    meridian_workflows_max: 100,
    meridian_executions_per_day: 10000,
    vektor_indexes_max: 10,
    vektor_documents_max: 1000000,
    aurum_accounts_max: 50000,
    workspace_members_max: 50,
    storage_gb: 100
  },
  'enterprise': {
    meridian_workflows_max: Infinity,
    meridian_executions_per_day: Infinity,
    vektor_indexes_max: Infinity,
    vektor_documents_max: Infinity,
    aurum_accounts_max: Infinity,
    workspace_members_max: Infinity,
    storage_gb: Infinity
  }
};
```

## Audit Logging

Track all data access and modifications:

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
```

**Usage**:

```typescript
async function logAuditEvent(
  orgId: string,
  workspaceId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  resourceType: string,
  resourceId: string,
  userId: string,
  req: Request,
  oldValues: any = null,
  newValues: any = null
) {
  await db.query(`
    INSERT INTO audit_logs (org_id, workspace_id, user_id, action, 
      resource_type, resource_id, old_values, new_values, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    orgId, workspaceId, userId, action, resourceType, resourceId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    getClientIp(req),
    req.headers['user-agent']
  ]);
}

// After creating workflow
await logAuditEvent(
  orgId, workspaceId, 'CREATE', 'workflow', workflowId, userId, req,
  null,
  { name: workflow.name, nodes: workflow.nodes.length }
);
```

## Compliance & Privacy

### GDPR Right to Erasure

Handle user data deletion across all services:

```typescript
async function deleteOrgData(orgId: string) {
  const pool = getDatabase();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Cascade delete all org data
    await client.query('DELETE FROM usage_events WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM workflows WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM executions WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM indexes WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM accounts WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM workspace_members WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    
    await client.query('COMMIT');
    
    // Log deletion
    logger.warn('Organization deleted', { org_id: orgId });
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### SOC 2 Requirements

- ✅ Encryption at rest (AES-256-GCM)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Audit logging (all actions tracked)
- ✅ Access controls (RBAC, org isolation)
- ✅ Vulnerability scanning (weekly)
- ✅ Incident response plan
- ✅ Annual penetration testing

---

**Last Updated**: March 24, 2026
