# Meridian - API Reference

Complete REST API documentation for the Meridian workflow orchestration engine.

## Authentication

All API endpoints require a valid JWT token in the `Authorization` header:

```bash
Authorization: Bearer {jwt_token}
```

## Workflows API

### List Workflows

```bash
GET /api/workflows?limit=20&offset=0&status=published

Headers:
  Authorization: Bearer {token}
  x-workspace-id: ws_prod
  Content-Type: application/json

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "wf_123",
      "name": "Process Orders",
      "description": "Order processing workflow",
      "status": "published",
      "nodes": 8,
      "executions_count": 1234,
      "created_by": "user_123",
      "created_at": "2024-03-24T10:30:00Z",
      "updated_at": "2024-03-24T11:45:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "has_next": true
  }
}
```

### Get Workflow

```bash
GET /api/workflows/{workflow_id}

Response (200):
{
  "status": "success",
  "data": {
    "id": "wf_123",
    "name": "Process Orders",
    "nodes": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "config": {
          "trigger_type": "webhook",
          "webhook_url": "https://api.stratos.dev/webhooks/wf_123"
        }
      },
      {
        "id": "llm_1",
        "type": "llm",
        "config": {
          "model": "gpt-4",
          "prompt": "Extract order details from: {{trigger_1.body}}"
        }
      },
      {
        "id": "db_1",
        "type": "database",
        "config": {
          "query": "INSERT INTO orders VALUES (...)"
        }
      }
    ],
    "edges": [
      { "source": "trigger_1", "target": "llm_1" },
      { "source": "llm_1", "target": "db_1" }
    ]
  }
}
```

### Create Workflow

```bash
POST /api/workflows

Body:
{
  "name": "Process Orders",
  "description": "Automated order processing",
  "nodes": [
    {
      "id": "trigger_1",
      "type": "trigger",
      "config": { "trigger_type": "webhook" }
    }
  ],
  "edges": []
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "wf_456",
    "name": "Process Orders",
    "status": "draft",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

### Update Workflow

```bash
PUT /api/workflows/{workflow_id}

Body:
{
  "name": "Updated workflow name",
  "nodes": [...],
  "edges": [...]
}

Response (200):
{
  "status": "success",
  "data": { "id": "wf_123", "updated_at": "2024-03-24T12:15:00Z" }
}
```

### Delete Workflow

```bash
DELETE /api/workflows/{workflow_id}

Response (204): No content
```

### Publish Workflow

```bash
POST /api/workflows/{workflow_id}/publish

Body:
{
  "changelog": "Added error handling for API failures"
}

Response (200):
{
  "status": "success",
  "data": {
    "id": "wf_123",
    "status": "published",
    "version": 2,
    "published_at": "2024-03-24T12:20:00Z"
  }
}
```

## Executions API

### List Executions

```bash
GET /api/workflows/{workflow_id}/executions?status=completed&limit=50

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "exec_789",
      "workflow_id": "wf_123",
      "status": "completed",
      "trigger_source": "webhook",
      "started_at": "2024-03-24T10:30:00Z",
      "completed_at": "2024-03-24T10:35:45Z",
      "duration_ms": 345000,
      "input_data": { "order_id": "ORD-123" },
      "output_data": { "status": "processed" }
    }
  ],
  "pagination": { "total": 1234 }
}
```

### Get Execution Details

```bash
GET /api/executions/{execution_id}

Response (200):
{
  "status": "success",
  "data": {
    "id": "exec_789",
    "workflow_id": "wf_123",
    "status": "completed",
    "nodes": [
      {
        "node_id": "trigger_1",
        "status": "succeeded",
        "output": { "body": {...} },
        "duration_ms": 12
      },
      {
        "node_id": "llm_1",
        "status": "succeeded",
        "output": { "text": "Order details extracted" },
        "duration_ms": 2345,
        "tokens_used": { "prompt": 120, "completion": 45 }
      }
    ]
  }
}
```

### Trigger Execution

```bash
POST /api/workflows/{workflow_id}/execute

Body:
{
  "input": {
    "order_id": "ORD-456",
    "customer_email": "customer@example.com"
  },
  "wait_for_completion": false
}

Response (202):
{
  "status": "success",
  "data": {
    "execution_id": "exec_890",
    "status": "queued"
  }
}
```

### Cancel Execution

```bash
POST /api/executions/{execution_id}/cancel

Response (200):
{
  "status": "success",
  "data": {
    "execution_id": "exec_789",
    "status": "cancelled",
    "cancelled_at": "2024-03-24T10:36:00Z"
  }
}
```

## Triggers API

### List Triggers

```bash
GET /api/workflows/{workflow_id}/triggers

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "trig_123",
      "workflow_id": "wf_123",
      "trigger_type": "webhook",
      "name": "Order Webhook",
      "webhook_url": "https://api.stratos.dev/webhooks/order-process",
      "is_active": true,
      "created_at": "2024-03-24T10:30:00Z"
    }
  ]
}
```

### Create Trigger

```bash
POST /api/workflows/{workflow_id}/triggers

Body:
{
  "trigger_type": "webhook",
  "name": "Order Processing Webhook",
  "trigger_config": {}
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "trig_456",
    "webhook_url": "https://api.stratos.dev/webhooks/order-process",
    "webhook_secret": "whsec_abc123..."
  }
}
```

### Webhook Trigger Format

```bash
POST {webhook_url}

Headers:
  Content-Type: application/json
  x-webhook-signature: sha256={hmac_signature}
  x-webhook-timestamp: {timestamp}

Body:
{
  "event": "order.created",
  "data": {
    "order_id": "ORD-789",
    "customer": "Acme Corp",
    "amount": 50000
  }
}

Response (202):
{
  "execution_id": "exec_999",
  "status": "queued"
}
```

## Credentials API

### List Credentials

```bash
GET /api/credentials?type=openai

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "cred_123",
      "name": "Production OpenAI Key",
      "credential_type": "openai",
      "created_at": "2024-03-24T10:30:00Z",
      "last_used_at": "2024-03-24T11:45:00Z"
    }
  ]
}
```

### Create Credential

```bash
POST /api/credentials

Body:
{
  "name": "OpenAI API Key",
  "credential_type": "openai",
  "credential_data": {
    "api_key": "sk-..."
  }
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "cred_456",
    "name": "OpenAI API Key",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

### Delete Credential

```bash
DELETE /api/credentials/{credential_id}

Response (204): No content
```

## Error Responses

### Validation Error

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow name is required",
    "details": {
      "field": "name"
    }
  }
}
```

### Unauthorized

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### Not Found

```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Workflow not found"
  }
}
```

### Rate Limited

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMITED",
    "message": "You have exceeded 1000 executions/hour",
    "retry_after_seconds": 3600
  }
}
```

---

**Last Updated**: March 24, 2026
