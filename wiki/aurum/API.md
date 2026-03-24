# Aurum - API Reference

Complete REST API documentation for the Aurum revenue intelligence platform.

## Authentication

All API endpoints require a valid JWT token:

```bash
Authorization: Bearer {jwt_token}
```

## Accounts API

### List Accounts

```bash
GET /api/accounts?health_score_min=50&churn_probability_min=0.5&limit=20

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "acct_123",
      "external_id": "salesforce_12345",
      "name": "TechCorp Inc",
      "arr": 150000,
      "mrr": 12500,
      "health_score": 42,
      "churn_probability": 0.72,
      "risk_tier": "HIGH",
      "lifecycle_stage": "at-risk",
      "created_at": "2024-03-24T10:30:00Z",
      "updated_at": "2024-03-24T11:45:00Z"
    }
  ],
  "pagination": { "total": 1234 }
}
```

### Get Account

```bash
GET /api/accounts/{account_id}

Response (200):
{
  "status": "success",
  "data": {
    "id": "acct_123",
    "name": "TechCorp Inc",
    "arr": 150000,
    "health_score": 42,
    "churn_probability": 0.72,
    "metrics": {
      "dau_7d": 45,
      "mau_30d": 120,
      "sessions_7d": 380,
      "active_seats": 12,
      "licensed_seats": 25,
      "utilization_percent": 48,
      "ticket_count_30d": 15,
      "avg_csat": 3.2,
      "days_to_renewal": 87
    }
  }
}
```

### Create Account

```bash
POST /api/accounts

Body:
{
  "external_id": "sf_54321",
  "name": "Acme Corporation",
  "arr": 250000,
  "industry": "Software",
  "country": "USA"
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "acct_456",
    "name": "Acme Corporation",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

### Update Account

```bash
PUT /api/accounts/{account_id}

Body:
{
  "arr": 275000,
  "lifecycle_stage": "established"
}

Response (200):
{
  "status": "success",
  "data": { "id": "acct_123", "updated_at": "2024-03-24T12:15:00Z" }
}
```

## Predictions API

### Get Churn Prediction

```bash
GET /api/accounts/{account_id}/prediction

Response (200):
{
  "status": "success",
  "data": {
    "account_id": "acct_123",
    "churn_probability": 0.72,
    "risk_tier": "HIGH",
    "predicted_churn_date": "2024-06-24",
    "model_version": "v1.2.3",
    "confidence": 0.89,
    "shap_explanation": {
      "factors": [
        {
          "feature": "Seat Utilization Drop",
          "value": 48,
          "contribution": 0.35,
          "direction": "increases_churn"
        },
        {
          "feature": "Payment Failures",
          "value": 2,
          "contribution": 0.28,
          "direction": "increases_churn"
        },
        {
          "feature": "Support Satisfaction",
          "value": 3.2,
          "contribution": -0.15,
          "direction": "decreases_churn"
        }
      ]
    },
    "created_at": "2024-03-24T10:30:00Z"
  }
}
```

### Recompute Prediction

```bash
POST /api/accounts/{account_id}/prediction/compute

Body:
{
  "include_explanations": true
}

Response (202):
{
  "status": "success",
  "data": {
    "job_id": "job_prediction_123",
    "status": "queued"
  }
}
```

## Dashboard API

### Executive Dashboard KPIs

```bash
GET /api/dashboard/kpis?period=current_quarter

Response (200):
{
  "status": "success",
  "data": {
    "kpis": {
      "arr": 5000000,
      "mrr": 416667,
      "logo_count": 250,
      "nrr": 125.3,
      "grr": 95.2,
      "logo_churn_rate": 3.2,
      "expansion_rate": 28.5
    },
    "arr_movement": {
      "new": 450000,
      "expansion": 250000,
      "contraction": -75000,
      "churn": -125000
    },
    "health_distribution": {
      "healthy": 180,
      "at_risk": 50,
      "high_risk": 20
    },
    "nrr_trend": {
      "periods": ["Jan", "Feb", "Mar"],
      "values": [120.1, 123.5, 125.3]
    }
  }
}
```

### At-Risk Accounts

```bash
GET /api/dashboard/at-risk?limit=50

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "acct_123",
      "name": "TechCorp Inc",
      "arr": 150000,
      "health_score": 42,
      "churn_probability": 0.72,
      "days_to_renewal": 39,
      "primary_risk_factor": "Seat Utilization Drop",
      "recommended_action": "CS Check-in"
    }
  ]
}
```

## Events API

### Ingest Events

```bash
POST /api/events/ingest/{org_id}

Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json

Body:
{
  "events": [
    {
      "event_type": "login",
      "account_id": "acct_123",
      "user_id": "user_456",
      "occurred_at": "2024-03-24T10:30:00Z",
      "metadata": {
        "session_id": "sess_xyz",
        "user_plan": "enterprise"
      }
    },
    {
      "event_type": "feature_used",
      "account_id": "acct_123",
      "user_id": "user_456",
      "event_subtype": "advanced_export",
      "occurred_at": "2024-03-24T10:35:00Z",
      "properties": {
        "export_type": "csv",
        "rows_exported": 5000
      }
    }
  ]
}

Response (202):
{
  "status": "success",
  "data": {
    "job_id": "job_events_789",
    "events_accepted": 2
  }
}
```

### Batch Event Ingestion (SDK)

```typescript
import { AurumClient } from '@stratos/aurum-sdk';

const aurum = new AurumClient({
  apiKey: 'ak_live_...',
  accountId: 'acct_123'
});

// Single event
aurum.track('feature_used', {
  feature: 'advanced_export',
  timestamp: Date.now()
});

// Batch events
aurum.trackBatch([
  { event: 'login', user_id: 'user_1', timestamp: Date.now() },
  { event: 'feature_used', feature: 'export', user_id: 'user_1' },
  { event: 'support_ticket', severity: 'high', user_id: 'user_2' }
]);

// Flush pending events
await aurum.flush();
```

## Alerts API

### List Alert Rules

```bash
GET /api/alerts/rules?is_active=true

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "rule_123",
      "name": "Health Score Critical",
      "condition_type": "health_score",
      "threshold": 30,
      "comparison_op": "<",
      "action_type": "slack",
      "action_config": {
        "channel": "#revenue-alerts"
      },
      "is_active": true
    }
  ]
}
```

### Create Alert Rule

```bash
POST /api/alerts/rules

Body:
{
  "name": "High Churn Risk",
  "condition_type": "churn_probability",
  "threshold": 0.7,
  "comparison_op": ">",
  "action_type": "email",
  "action_config": {
    "recipients": ["cs@acme.com", "ceo@acme.com"]
  }
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "rule_456",
    "name": "High Churn Risk",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

### Update Alert Rule

```bash
PUT /api/alerts/rules/{rule_id}

Body:
{
  "threshold": 0.65,
  "action_config": {
    "recipients": ["cs@acme.com"]
  }
}

Response (200):
{
  "status": "success",
  "data": { "id": "rule_123", "updated_at": "2024-03-24T12:15:00Z" }
}
```

### Delete Alert Rule

```bash
DELETE /api/alerts/rules/{rule_id}

Response (204): No content
```

## Health Score API

### Get Health Score Timeline

```bash
GET /api/accounts/{account_id}/health-timeline?days=90

Response (200):
{
  "status": "success",
  "data": {
    "timeline": [
      {
        "date": "2024-03-24",
        "health_score": 42,
        "engagement": 45,
        "utilization": 48,
        "support": 35,
        "financial": 50,
        "relationship": 30
      }
    ]
  }
}
```

## Error Responses

### Account Not Found

```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Account not found"
  }
}
```

### Invalid Event Format

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Event validation failed",
    "details": {
      "field": "event_type",
      "error": "Required field missing"
    }
  }
}
```

### Quota Exceeded

```json
{
  "status": "error",
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have exceeded 1000 events/second",
    "retry_after_seconds": 60
  }
}
```

---

**Last Updated**: March 24, 2026
