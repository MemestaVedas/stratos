# Shared Architecture - System Design

## Multi-Tenant Data Model

All three Stratos products share a common tenant hierarchy:

```
Stratos Platform
  │
  ├── Organization (e.g., "Acme Corp") ← Billing unit
  │   ├── Workspace 1
  │   │   ├── Product A resources
  │   │   ├── Product B resources
  │   │   └── Product C resources
  │   ├── Workspace 2
  │   └── ...
  │
  └── (multiple orgs with complete isolation)
```

### Organizational Isolation

Every query must include **organization ID** as a filter:

```sql
-- ❌ WRONG - could leak data across orgs
SELECT * FROM accounts;

-- ✅ CORRECT - always filter by org_id
SELECT * FROM accounts WHERE org_id = ?;
```

Every request must validate:
```typescript
const orgId = getOrgIdFromAuth(req);
const workspace = await getWorkspace(req.params.workspaceId);

// Verify workspace belongs to org
if (workspace.org_id !== orgId) {
  throw new UnauthorizedError();
}
```

## Shared Infrastructure

### PostgreSQL Databases

One database per product, shared across all orgs/workspaces:

```
PostgreSQL Instance
├── meridian_db          (Workflows, Executions)
├── vektor_db            (Indexes, Chunks)
└── aurum_db             (Accounts, Predictions)
```

**Connection String Pattern:**
```
postgresql://user:password@host:5432/meridian?sslmode=require
```

### Redis

One Redis instance for all services, with namespaced keys:

```
redis://host:6379

Key patterns:
meridian:workflow:{id}           → Cached workflow definition
meridian:execution:{id}:logs     → Execution log stream
vektor:index:{id}:chunks         → Chunk vectors
vektor:query:{hash}:result       → Query result cache
aurum:account:{id}:score         → Cached health score
aurum:events:{org_id}            → Event stream
```

**Usage**:
```typescript
// Cache workflow
await redis.setex(
  `meridian:workflow:${workflowId}`,
  300,  // 5 minute TTL
  JSON.stringify(workflow)
);

// Publish event
await redis.publish(
  `meridian:execution:${executionId}:events`,
  JSON.stringify(event)
);

// Subscribe to stream
const SUB = redis.subscribe(`meridian:execution:${executionId}:events`);
```

### BullMQ Job Queue

Centralized async job processing across all services:

```
Redis Queue Instance
├── meridian:workflow:execute    (Workflow execution jobs)
├── vektor:ingestion:process     (Data pipeline jobs)
├── aurum:event:process          (Event aggregation jobs)
└── aurum:training:job           (Model training jobs)
```

**Setup**:
```typescript
import Bull from 'bull';

const workflowQueue = new Bull('meridian:workflow:execute', {
  redis: { host: 'localhost', port: 6379 }
});

workflowQueue.process(
  10,  // concurrency
  async (job) => {
    await executeWorkflow(job.data);
  }
);

workflowQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});
```

## API Standards

### Common Headers

All API requests must include:

```
GET /api/resource HTTP/1.1
Host: api.stratos.dev
Authorization: Bearer {jwt_token}
Content-Type: application/json
x-workspace-id: {workspace_uuid}
x-request-id: {unique_request_id}
```

### Error Responses

Consistent error format across all services:

```json
{
  "error": "Validation Error",
  "message": "Health score must be between 0 and 100",
  "code": "INVALID_INPUT",
  "details": {
    "field": "health_score",
    "value": 150
  },
  "request_id": "req_xyz123"
}
```

### Pagination

Standard pagination for list endpoints:

```bash
GET /api/accounts?limit=20&offset=0

# Response
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1500,
    "has_next": true
  }
}
```

### Real-Time Updates (SSE)

Server-Sent Events for live streams:

```bash
GET /api/executions/{execId}/stream HTTP/1.1

# Response
event: execution_status
data: {"status":"RUNNING","progress":0.35}

event: node_complete
data: {"nodeId":"llm_1","output":{"text":"..."}}

event: execution_complete
data: {"status":"COMPLETED","duration_ms":5200}
```

## Authentication & Authorization

### JWT Structure

```typescript
{
  "sub": "user_123",
  "org_id": "org_acme",
  "workspace_id": "ws_prod",
  "email": "user@acme.com",
  "role": "workspace_admin",  // org_owner, workspace_admin, editor, viewer
  "permissions": ["workflow:read", "workflow:write", "execution:run"],
  "iat": 1711271400,
  "exp": 1711357800
}
```

### RBAC Matrix

| Role | Meridian | Vektor | Aurum |
|------|----------|--------|-------|
| Org Owner | Full | Full | Full |
| Workspace Admin | Manage all | Manage all | View all, manage config |
| Workspace Editor | Create/edit/run | Create/edit | Query only |
| Workspace Viewer | View only | View/query | View only |

## Rate Limiting

Per-workspace quotas enforced at API gateway:

```typescript
const quotas = {
  meridian: {
    execution_per_day: 10000,
    nodes_per_workflow: 500
  },
  vektor: {
    queries_per_day: 100000,
    ingestion_jobs_per_day: 100,
    chunks_per_index: 1000000
  },
  aurum: {
    events_per_second: 1000,
    accounts_per_org: 100000
  }
};
```

When limit reached:
```json
{
  "error": "Rate Limit Exceeded",
  "message": "You have exceeded 10000 executions/day",
  "retry_after_seconds": 86400,
  "limit_type": "meridian:daily_executions"
}
```

## Logging & Observability

### Structured Logging

All logs in JSON format with context:

```typescript
logger.info('Workflow execution started', {
  workflow_id: 'wf_123',
  execution_id: 'exec_456',
  org_id: 'org_acme',
  user_id: 'user_789',
  timestamp: '2026-03-24T10:30:00Z'
});
```

### Log Levels

- `debug`: Detailed diagnostic info
- `info`: General informational messages
- `warn`: Warning conditions (retries, degraded service)
- `error`: Error conditions (failures, exceptions)

### Metrics to Track

**Performance**:
- API latency (p50, p90, p99)
- Database query latency
- Cache hit ratio
- Job queue depth

**Business**:
- Workflows executed per day
- Queries per day
- Indexed documents
- Churn predictions computed

**Reliability**:
- Error rate by endpoint
- Database connection pool utilization
- Job failure rate
- Service restart count

## Database Design Principles

### Schema Strategy

1. **One database per product** for scalability
2. **Multi-tenancy columns** on every table (org_id, workspace_id)
3. **Indexes on tenant columns** for fast filtering
4. **Soft deletes** for audit trail
5. **Timestamps** (created_at, updated_at) on all tables

### Index Strategy

```sql
-- Always index tenant columns
CREATE INDEX idx_accounts_org ON accounts(org_id);
CREATE INDEX idx_accounts_workspace ON accounts(workspace_id);

-- Index frequently filtered columns
CREATE INDEX idx_workflow_status ON workflows(status);
CREATE INDEX idx_execution_created ON executions(created_at);

-- Range query indexes
CREATE INDEX idx_events_timestamp ON usage_events(occurred_at DESC);
```

### Connection Pooling

```typescript
const pool = new Pool({
  max: 20,                        // Max connections
  idleTimeoutMillis: 30000,       // Close idle after 30s
  connectionTimeoutMillis: 2000   // Connect timeout
});
```

## Deployment Architecture

### Service Layout

```
AWS / GCP / On-Prem
├── API Gateway
│   ├── Load Balancer
│   ├── Auth/RBAC
│   └── Rate Limiting
├── Meridian Deployment
│   ├── API Pod(s)
│   └── Worker Pod(s)
├── Vektor Deployment
│   ├── API Pod(s)
│   ├── Python Service Pod(s)
│   └── Ingestion Worker Pod(s)
├── Aurum Deployment
│   ├── API Pod(s)
│   ├── ML Service Pod(s)
│   └── Event Worker Pod(s)
└── Shared Infrastructure
    ├── PostgreSQL Cluster
    ├── Redis Cluster
    ├── Object Storage (S3, GCS)
    └── Monitoring/Logging Stack
```

### Environment Configuration

**Development** (local):
```env
NODE_ENV=development
DB_HOST=localhost
REDIS_HOST=localhost
LOG_LEVEL=debug
```

**Staging** (cloud):
```env
NODE_ENV=staging
DB_HOST=postgres-staging.internal
REDIS_HOST=redis-staging.internal
LOG_LEVEL=info
```

**Production** (cloud):
```env
NODE_ENV=production
DB_HOST=postgres-prod.internal
REDIS_HOST=redis-prod.internal
LOG_LEVEL=warn
```

## Security Practices

### Encryption

- **In Transit**: TLS 1.3 for all API calls
- **At Rest**: AES-256-GCM for sensitive data
  - API keys
  - OAuth tokens
  - Database passwords
  - Customer credentials

**Key Rotation**: Annual rotation of master keys

### Secret Management

Use environment variables + secret vault (AWS Secrets Manager, HashiCorp Vault):

```typescript
const dbPassword = await secretsVault.get('db_password');
const openaiKey = await secretsVault.get('openai_api_key');
```

### Access Control

1. **API Keys**: Workspace-scoped, revocable per key
2. **JWT Tokens**: Short-lived (1 hour), refresh tokens for long-term
3. **Database Credentials**: Per-environment, rotated regularly

## Disaster Recovery

### Backup Strategy

- **Database**: Continuous replication + daily snapshots (30-day retention)
- **Object Storage**: Cross-region replication
- **Configuration**: Version-controlled in Git

### RTO/RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| API Services | 5 min | minimal |
| Database | 30 min | 1 hour |
| Object Storage | 1 hour | 24 hours |

### Failover Procedure

1. Detect failure via health checks
2. Trigger automated failover to standby
3. Redirect traffic to new region
4. Verify data consistency
5. Run post-mortem

---

**Last Updated**: March 24, 2026
