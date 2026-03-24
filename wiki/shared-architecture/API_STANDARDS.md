# API Standards & Conventions

## Request/Response Format

### Standard HTTP Headers

All API requests must include auth and workspace context:

```http
POST /api/workflows HTTP/1.1
Host: api.stratos.dev
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
x-workspace-id: ws_prod_acme
x-request-id: req_123abc
x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000
```

| Header | Purpose | Example |
|--------|---------|---------|
| `Authorization` | JWT bearer token | `Bearer eyJ...` |
| `Content-Type` | Request format | `application/json` |
| `x-workspace-id` | Workspace context | `ws_prod_acme` |
| `x-request-id` | Request tracing | `req_123abc` |
| `x-idempotency-key` | Idempotent requests | UUID |

### Standard Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | Workflow retrieved |
| `201` | Created | Workflow created |
| `202` | Accepted | Job queued |
| `204` | No Content | Resource deleted |
| `400` | Bad Request | Invalid input |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already exists |
| `429` | Rate Limited | Too many requests |
| `500` | Server Error | Unexpected error |

### Success Response Format

```json
{
  "status": "success",
  "data": {
    "id": "wf_123",
    "name": "Process Orders",
    "status": "published",
    "nodes": [...]
  },
  "pagination": null
}
```

### Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow name is required",
    "details": {
      "field": "name",
      "constraint": "required"
    }
  },
  "request_id": "req_123abc"
}
```

### List Response Format

```json
{
  "status": "success",
  "data": [
    { "id": "wf_1", "name": "Workflow 1" },
    { "id": "wf_2", "name": "Workflow 2" }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 142,
    "has_next": true,
    "has_prev": false
  }
}
```

## REST Conventions

### Naming Patterns

**Resources use plural nouns**:
```
GET    /api/workflows           # List
GET    /api/workflows/:id       # Get one
POST   /api/workflows           # Create
PUT    /api/workflows/:id       # Update
DELETE /api/workflows/:id       # Delete
```

**Nested resources use hierarchy**:
```
GET    /api/workflows/:id/executions        # List executions for workflow
POST   /api/workflows/:id/executions        # Create execution
GET    /api/workflows/:id/executions/:eid   # Get one execution
```

**Actions as separate endpoints**:
```
POST   /api/workflows/:id/publish          # Action: publish
POST   /api/workflows/:id/duplicate        # Action: duplicate
POST   /api/executions/:id/cancel          # Action: cancel
```

### Query Parameters

**Common filters**:
```
GET /api/workflows?
  status=published
  &created_after=2024-01-01
  &created_before=2024-03-31
  &created_by=user_123
```

**Pagination**:
```
GET /api/workflows?
  limit=50          # Page size (max 100)
  &offset=100       # Skip N records
  &sort=-created_at # Sort field (- = desc)
```

**Field selection**:
```
GET /api/workflows/wf_123?
  fields=id,name,status    # Only return these fields
```

## Authentication

### JWT Token Structure

Issued by auth service, verified by all services:

```json
{
  "iss": "https://auth.stratos.dev",
  "sub": "user_123",
  "aud": "api.stratos.dev",
  "iat": 1711271400,
  "exp": 1711357800,
  "org_id": "org_acme",
  "workspace_id": "ws_prod",
  "role": "workspace_admin",
  "permissions": [
    "workflow:read",
    "workflow:write",
    "workflow:execute"
  ]
}
```

### Token Verification

```typescript
import jwt from 'jsonwebtoken';

const authMiddleware = (req: Request, res: Response, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new UnauthorizedError('Missing authorization token');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
      issuer: 'https://auth.stratos.dev',
      audience: 'api.stratos.dev'
    });
    
    req.jwt = decoded;
    next();
    
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
```

### Refresh Tokens

Access token: 1 hour (short-lived)
Refresh token: 30 days (stored securely in httpOnly cookie)

```bash
# Initial login
POST /auth/login
Body: { email, password }
Response: { access_token, refresh_token }

# Refresh access token (before expiry)
POST /auth/refresh
Body: { refresh_token }
Response: { access_token, refresh_token }
```

## Validation

### Input Validation

Use JSON Schema for validation:

```typescript
const createWorkflowSchema = {
  type: 'object',
  required: ['name', 'nodes'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', maxLength: 2000 },
    nodes: {
      type: 'array',
      minItems: 1,
      maxItems: 500,
      items: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9_]+$' },
          type: { enum: ['trigger', 'llm', 'webhook', 'condition', 'merge'] },
          config: { type: 'object' }
        }
      }
    }
  }
};

// Validation middleware
const validate = (schema) => {
  return (req: Request, res: Response, next) => {
    const ajv = new Ajv();
    const valid = ajv.validate(schema, req.body);
    
    if (!valid) {
      throw new ValidationError('Invalid input', ajv.errors);
    }
    
    next();
  };
};

// Usage
router.post('/api/workflows', validate(createWorkflowSchema), async (req, res) => {
  // ...
});
```

### Field Constraints

```typescript
// String constraints
name: { type: 'string', minLength: 1, maxLength: 255 }
slug: { type: 'string', pattern: '^[a-z0-9-]+$' }
email: { type: 'string', format: 'email' }

// Number constraints
health_score: { type: 'number', minimum: 0, maximum: 100 }
timeout_seconds: { type: 'integer', minimum: 1, maximum: 3600 }

// Array constraints
tags: { type: 'array', items: { type: 'string' }, maxItems: 20 }

// Enum constraints
status: { enum: ['draft', 'published', 'archived'] }
```

## Pagination Best Practices

### Offset/Limit Pagination

Simple but less efficient for large datasets:

```bash
GET /api/workflows?limit=20&offset=0
```

Use when:
- Dataset < 10K records
- Users navigate sequentially

### Cursor Pagination (Recommended)

More efficient for large datasets:

```bash
GET /api/workflows?limit=20&cursor=<cursor_token>

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEwMDAwIn0=",
    "prev_cursor": "eyJpZCI6IjEwMDAxIn0=",
    "has_next": true
  }
}
```

Cursor token is base64-encoded:
```json
{"id": "wf_10000", "created_at": "2024-03-24T10:30:00Z"}
```

## Rate Limiting

### Header Format

```http
HTTP/1.1 200 OK
x-ratelimit-limit: 1000
x-ratelimit-remaining: 998
x-ratelimit-reset: 1711357800
```

### Rate Limit Exceeded

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "Rate Limit Exceeded",
  "message": "You have exceeded 1000 requests/hour",
  "retry_after_seconds": 60,
  "limit_type": "api_requests_per_hour"
}
```

### Quota Tracking

```bash
# Check quota before making requests
GET /api/quota
Response: {
  "meridian_executions_today": 5234,
  "meridian_executions_limit": 10000,
  "vektor_queries_today": 45123,
  "vektor_queries_limit": 100000
}
```

## Idempotency

Use `x-idempotency-key` header for safe retries:

```bash
POST /api/workflows
x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000
Body: { "name": "New Workflow" }

# Server stores: idempotency_key -> response
# Retry with same key returns cached response
```

**Storage**:
```sql
CREATE TABLE idempotency_keys (
  key UUID PRIMARY KEY,
  user_id UUID,
  method VARCHAR(10),
  path VARCHAR(255),
  response JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
);

-- Cleanup old keys
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

## Versioning

### API Versioning Strategy

Use URL path versioning:

```
/api/v1/workflows  (Stable, long-term support)
/api/v2/workflows  (New features, breaking changes)
```

**Deprecation timeline**:
- v1 deprecated → v1 still works (12 months)
- v1 sunset → v1 returns 410 Gone

**Header for version negotiation**:
```http
Accept-Version: 2.0
```

## Time Handling

All times in ISO 8601 UTC:

```json
{
  "created_at": "2024-03-24T10:30:00Z",
  "updated_at": "2024-03-24T11:45:30.123Z",
  "executed_at": "2024-03-24T10:32:15.456789Z"
}
```

Use Unix timestamps internally, ISO 8601 in APIs.

## Async Operations

For long-running operations, return job ID immediately:

```bash
POST /api/workflows/wf_123/duplicate
Response: { status: 202, job_id: "job_xyz" }

# Poll for completion
GET /api/jobs/job_xyz
Response: {
  "status": "completed",
  "result": { "new_workflow_id": "wf_456" }
}
```

---

**Last Updated**: March 24, 2026
