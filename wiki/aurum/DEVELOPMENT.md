# Aurum - Comprehensive Development Guide

## Overview

Aurum is Stratos' revenue intelligence platform with ML-powered churn prediction, real-time health scoring, and executive dashboards. It helps B2B SaaS companies predict customer churn before it happens and optimize revenue growth.

## Architecture

```
┌──────────────────────────────┐
│  Frontend (Next.js)          │
│  - Executive Dashboard       │
│  - Account Detail Pages      │
│  - Alert & Playbook Manager  │
└────────────┬─────────────────┘
             │
┌────────────▼──────────────────┐
│  API Gateway (Auth, RBAC)    │
└────────────┬──────────────────┘
             │
┌────────────▼────────────────────────────┐
│  Aurum API (Node.js + Express)          │
│  - Account Management                  │
│  - Event Ingestion                     │
│  - Prediction API                      │
│  - Dashboard Metrics                   │
│  - Alerting Engine                     │
└──┬──────────┬──────────┬────────┬──────┘
   │          │          │        │
   ▼          ▼          ▼        ▼
PostgreSQL  Redis    BullMQ  FastAPI/
(metadata) (cache)  (jobs)   Python
                              (ML)
```

## Project Structure

```
aurum/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   └── redis.ts
│   │   ├── models/
│   │   │   ├── Account.ts
│   │   │   ├── Prediction.ts
│   │   │   └── Event.ts
│   │   ├── routes/
│   │   │   ├── accounts.ts         # CRUD operations
│   │   │   ├── dashboard.ts        # KPI endpoints
│   │   │   ├── predictions.ts      # Churn scores, SHAP
│   │   │   ├── events.ts           # Event ingestion
│   │   │   └── alerts.ts           # Alert rules
│   │   ├── services/
│   │   │   ├── ml/                 # Model serving
│   │   │   ├── integrations/       # CRM, billing
│   │   │   ├── health-score.ts     # Real-time scoring
│   │   │   └── alert-engine.ts
│   │   └── utils/
│   │       └── logger.ts
│   ├── package.json
│   └── tsconfig.json
├── ml-service/
│   ├── src/
│   │   ├── models/
│   │   │   ├── churn_model.pkl    # XGBoost
│   │   │   └── scaler.pkl          # Feature scaling
│   │   ├── training/
│   │   │   ├── pipeline.py
│   │   │   ├── feature_engineering.py
│   │   │   └── evaluation.py
│   │   ├── serving/
│   │   │   ├── predictor.py        # Model inference
│   │   │   ├── shap_explainer.py   # SHAP values
│   │   │   └── api.py              # FastAPI endpoints
│   │   └── utils/
│   │       └── logger.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── ExecutiveDashboard.tsx
│   │   │   │   ├── KPICards.tsx
│   │   │   │   ├── ARRWaterfall.tsx
│   │   │   │   ├── HealthDistribution.tsx
│   │   │   │   └── AtRiskAccounts.tsx
│   │   │   ├── account/
│   │   │   │   ├── AccountDetail.tsx
│   │   │   │   ├── HealthTimeline.tsx
│   │   │   │   ├── ShapExplanation.tsx
│   │   │   │   └── NextBestActions.tsx
│   │   │   └── alerts/
│   │   ├── pages/
│   │   │   ├── dashboard.tsx
│   │   │   ├── accounts/[id].tsx
│   │   │   └── alerts.tsx
│   │   └── api/
│   │       └── client.ts
│   └── package.json
├── docs/
│   └── ARCHITECTURE.md
└── README.md
```

## Core Concepts

### Multi-Account Event Flow

Aurum is designed for **SaaS companies managing multiple customer accounts**:

```
Your SaaS Company
  └── Aurum Org
      ├── Account: Acme Corp
      │   ├── MRR: $50K
      │   ├── Health Score: 75
      │   ├── Churn Probability: 15%
      │   └── Events: [usage, billing, support]
      ├── Account: TechCorp
      │   ├── MRR: $100K
      │   ├── Health Score: 42
      │   ├── Churn Probability: 68%
      │   └── Events: [usage, billing, support]
      └── ...
```

### Health Score Components

Real-time composite score (0-100) from:

```typescript
Score = (
  Engagement: 30% → composite of DAU/MAU ratio, sessions/week, feature breadth
  + Utilization: 20% → active_seats / licensed_seats
  + Support: 15% → penalize high tickets, low CSAT
  + Financial: 20% → payment failures, downgrades
  + Relationship: 15% → days since last CS touchpoint
)
```

Each component has configurable weights per organization.

### Churn Prediction ML Model

**XGBoost binary classifier** predicting churn within 90 days:

```
Features (from account_metrics):
  - DAU/MAU ratio (last 7, 30 days)
  - Session frequency
  - Feature adoption breadth
  - Seat utilization rate
  - Support ticket volume/CSAT
  - Payment failure count
  - Downgrade history
  - Days to renewal
  - Health score trend
  - Tenure
  - ARR segment

Output:
  - Churn probability (0-1)
  - Risk tier (LOW/MEDIUM/HIGH)
  - Top 5 SHAP values (feature contributions)
```

**Training Pipeline**:
1. Extract features for all accounts (24-month history)
2. Label accounts as churned/retained
3. Train/test split (80/20)
4. Hyperparameter grid search
5. Evaluate AUC-ROC (target ≥ 0.75)
6. Compute SHAP values for explainability
7. Promote new model only if AUC improves ≥ 2%
8. Store model version for auditability

## Development Workflow

### 1. Set Up Integration (Stripe Example)

```typescript
// src/integrations/stripe.ts

export class StripeIntegration {
  async syncAccounts() {
    const customers = await stripe.customers.list();
    
    for (const customer of customers.data) {
      await AccountModel.createOrUpdate({
        external_id: customer.id,
        name: customer.name,
        email: customer.email
      });
    }
  }
  
  async onWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'customer.subscription.created':
        // Track new subscription
        break;
      case 'customer.subscription.deleted':
        // Track cancellation
        break;
      case 'invoice.created':
        // Track revenue event
        break;
    }
  }
}
```

### 2. Ingest Usage Events

```bash
# Using SDK in your app
npm install @stratos/aurum-sdk

# In your code
import { AurumClient } from '@stratos/aurum-sdk';

const aurum = new AurumClient({
  apiKey: 'ak_live_...',
  accountId: 'acme_corp'
});

// Track feature usage
aurum.track('feature_used', {
  feature: 'advanced_export',
  timestamp: Date.now(),
  plan: 'enterprise',
  user_id: 'user_123'
});

// Or batch events
aurum.trackBatch([
  { event: 'login', user_id: 'user_1', timestamp: Date.now() },
  { event: 'login', user_id: 'user_2', timestamp: Date.now() },
  { event: 'feature_used', feature: 'export', user_id: 'user_1' }
]);
```

### 3. Real-Time Health Score Recalculation

```typescript
// src/services/health-score.ts

async function recalculateHealthScore(accountId: string) {
  const account = await AccountModel.getById(accountId);
  const metrics = await AccountMetricsModel.getLatest(accountId);
  
  // Calculate components
  const engagement = calculateEngagement(metrics);
  const utilization = calculateUtilization(metrics);
  const support = calculateSupport(metrics);
  const financial = calculateFinancial(metrics);
  const relationship = calculateRelationship(metrics);
  
  // Apply org-specific weights
  const weights = await OrgWeightsModel.getByOrg(account.org_id);
  
  const healthScore = (
    engagement * weights.engagement +
    utilization * weights.utilization +
    support * weights.support +
    financial * weights.financial +
    relationship * weights.relationship
  ) * 100;
  
  // Update
  await AccountModel.updateHealthScore(accountId,health Score);
  
  // Emit real-time event
  emitEvent({
    type: 'health_score_updated',
    accountId,
    old_score: account.health_score,
    new_score: healthScore,
    change: healthScore - account.health_score
  });
  
  // Check alert rules
  await checkAlertRules(accountId, healthScore);
}
```

### 4. Get Churn Prediction

```bash
# POST /api/predictions/:accountId/compute
curl -X POST http://localhost:3002/api/predictions/acme_corp/compute \
  -H "x-org-id: org_123"

# Response:
# {
#   churn_probability: 0.78,
#   risk_tier: "HIGH",
#   shap_explanation: {
#     top_factors: [
#       { factor: "Seat Utilization Drop", direction: "negative", contribution: 0.35 },
#       { factor: "Payment Failures", direction: "negative", contribution: 0.28 },
#       ...
#     ]
#   },
#   model_version: "v1.2.3",
#   computed_at: "2026-03-24T10:30:00Z"
# }
```

### 5. Executive Dashboard

```bash
# GET /api/dashboard/org_123
curl http://localhost:3002/api/dashboard/org_123 \
  -H "x-org-id: org_123"

# Response includes:
# {
#   kpis: {
#     arr: 2500000,
#     mrr: 208333,
#     nrr: 125.3,
#     grr: 95.2,
#     logo_churn_rate: 3.2
#   },
#   arr_movement: { months, new, expansion, contraction, churn },
#   health_distribution: { healthy, at_risk, high_risk },
#   at_risk_accounts: [ ... ],
#   nrr_trend: { months, values }
# }
```

### 6. Account Intelligence Page

```typescript
// frontend/src/pages/accounts/[id].tsx

export default function AccountDetailPage({ accountId }: Props) {
  const [account, setAccount] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    // Fetch account details
    api.getAccount(accountId).then(setAccount);
    
    // Fetch churn prediction
    api.getPrediction(accountId).then(setPrediction);
    
    // Fetch event timeline
    api.getEventHistory(accountId).then(setEvents);
  }, [accountId]);
  
  return (
    <div>
      {/* Header: Name, ARR, Plan, Health Score, Churn Prob */}
      <AccountHeader account={account} prediction={prediction} />
      
      {/* Timeline: Chronological feed of all events */}
      <EventTimeline events={events} />
      
      {/* Usage analytics: DAU/MAU, session frequency, features */}
      <UsageAnalytics account={account} />
      
      {/* Health score history: 90-day sparkline */}
      <HealthHistory account={account} />
      
      {/* SHAP explanation breakdown */}
      <ShapExplanation prediction={prediction} />
      
      {/* AI-generated account summary */}
      <AccountSummary account={account} prediction={prediction} />
      
      {/* Next Best Actions: rule-based + ML-ranked suggestions */}
      <NextBestActions account={account} prediction={prediction} />
      
      {/* CS activity log: calls, emails, QBR, reminders */}
      <CSActivityLog account={account} />
    </div>
  );
}
```

## Key Implementation Details

### Event Ingestion Pipeline

```typescript
// src/routes/events.ts

router.post('/ingest/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const events = req.body.events || [];
  
  // 1. Validate API key
  const apiKey = req.headers.authorization;
  if (!validateApiKey(apiKey, orgId)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // 2. Batch insert to queue
  const jobId = uuidv4();
  const job = await queue.add('process_events', {
    org_id: orgId,
    events: events
  });
  
  // 3. Return accepted
  res.status(202).json({
    status: 'ACCEPTED',
    job_id: jobId,
    events_accepted: events.length
  });
});

// Worker processes batches
queue.process('process_events', async (job) => {
  const { org_id, events } = job.data;
  
  for (const event of events) {
    // Upsert event
    await db.query(`
      INSERT INTO usage_events (org_id, account_id, event_type, metadata, occurred_at)
      VALUES ($1, $2, $3, $4, $5)
    `);
    
    // Trigger health score recalculation
    await recalculateHealthScore(event.account_id);
    
    // Emit to Redis pub/sub for real-time dashboard
    await redis.publish(`events:${org_id}`, JSON.stringify(event));
  }
});
```

### Health Score Calculation

```typescript
// src/services/health-score.ts

function calculateEngagement(metrics: Metrics): number {
  const dau_mau_ratio = metrics.dau_7d / metrics.mau_30d;
  const session_frequency = metrics.sessions_7d / 7;
  const feature_breadth = metrics.unique_features_used / metrics.total_available_features;
  
  // Weighted composite
  return (
    dau_mau_ratio * 0.4 +
    Math.min(session_frequency, 1) * 0.4 +
    feature_breadth * 0.2
  );
}

function calculateUtilization(metrics: Metrics): number {
  const utilization = metrics.active_seats / metrics.licensed_seats;
  
  // Penalize low utilization
  if (utilization < 0.6) {
    return utilization * 0.5;  // Apply penalty
  }
  return utilization;
}

function calculateSupport(metrics: Metrics): number {
  let score = 1.0;
  
  // Penalize high ticket volume
  if (metrics.ticket_count > 50) {
    score -= 0.3;
  }
  
  // Penalize low CSAT
  if (metrics.avg_csat < 0.7) {
    score -= (0.7 - metrics.avg_csat) * 2;
  }
  
  // Penalize unresolved P1 tickets
  if (metrics.unresolved_p1_tickets > 0) {
    score -= 0.5;
  }
  
  return Math.max(score, 0);
}

function calculateFinancial(metrics: Metrics): number {
  let score = 1.0;
  
  // Penalize payment failures
  score -= metrics.payment_failures * 0.1;
  
  // Penalize downgrades/expansions
  if (metrics.plan_downgrades > 0) {
    score -= 0.2;
  }
  if (metrics.plan_upgrades > 0) {
    score += 0.1;
  }
  
  return Math.max(score, 0);
}

function calculateRelationship(metrics: Metrics): number {
  const days_since_interaction = Math.floor(
    (Date.now() - metrics.last_interaction) / (1000 * 60 * 60 * 24)
  );
  
  // Penalize inactivity
  let score = 1.0;
  if (days_since_interaction > 90) {
    score = 0;
  } else if (days_since_interaction > 30) {
    score = 0.5;
  }
  
  return score;
}
```

### ML Model Training

```python
# ml-service/src/training/pipeline.py

import xgboost as xgb
from sklearn.preprocessing import StandardScaler
import shap

def train_churn_model(org_id: str):
    """Train org-specific churn prediction model"""
    
    # 1. Fetch features (24-month history)
    X, y = fetch_training_data(org_id, lookback_months=24)
    
    # 2. Feature scaling
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 3. Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    # 4. Grid search for hyperparameters
    params_grid = {
        'max_depth': [3, 5, 7],
        'learning_rate': [0.01, 0.05, 0.1],
        'n_estimators': [100, 200, 500]
    }
    
    best_score = 0
    best_model = None
    
    for depth in params_grid['max_depth']:
        for lr in params_grid['learning_rate']:
            for n in params_grid['n_estimators']:
                model = xgb.XGBClassifier(
                    max_depth=depth,
                    learning_rate=lr,
                    n_estimators=n
                )
                model.fit(X_train, y_train)
                
                score = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
                
                if score > best_score:
                    best_score = score
                    best_model = model
    
    # 5. Evaluate on test set
    y_pred_proba = best_model.predict_proba(X_test)[:, 1]
    auc_roc = roc_auc_score(y_test, y_pred_proba)
    
    print(f"Model AUC-ROC: {auc_roc}")
    
    if auc_roc < 0.75:
        raise ValueError("Model performance below threshold")
    
    # 6. Compute SHAP values
    explainer = shap.TreeExplainer(best_model)
    shap_values = explainer.shap_values(X_test)
    
    # 7. Save model and metadata
    metadata = {
        'org_id': org_id,
        'version': f"v{get_next_version(org_id)}",
        'auc_roc': auc_roc,
        'n_features': X.shape[1],
        'feature_names': list(X.columns),
        'training_date': datetime.now().isoformat(),
        'training_samples': len(X_train)
    }
    
    save_model(best_model, scaler, metadata)
    
    return metadata
```

### SHAP Explanation

```python
# ml-service/src/serving/shap_explainer.py

def explain_prediction(account_id: str, features: Dict) -> ShapExplanation:
    """Generate SHAP-based explanation for churn prediction"""
    
    # Load model
    model = load_model(account_id)
    explainer = load_explainer(account_id)
    
    # Prepare features
    X = prepare_features(features)
    
    # Compute SHAP values
    shap_val = explainer.shap_values(X)[0]  # Class 1 (churn)
    
    # Extract top contributors
    top_indices = np.argsort(np.abs(shap_val))[-5:][::-1]
    
    explanation = {
        'factors': [],
        'base_value': explainer.expected_value[1]
    }
    
    for idx in top_indices:
        factor_name = get_feature_name(idx)
        shap_contribution = shap_val[idx]
        
        explanation['factors'].append({
            'feature': factor_name,
            'value': features[factor_name],
            'contribution': float(shap_contribution),
            'direction': 'increases' if shap_contribution > 0 else 'decreases'
        })
    
    return explanation
```

## Database Schema

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  external_id VARCHAR(255),     -- CRM ID (Salesforce, HubSpot)
  name VARCHAR(255) NOT NULL,
  arr NUMERIC(12, 2) DEFAULT 0,
  health_score NUMERIC(5, 2) DEFAULT 75,
  churn_probability NUMERIC(5, 4) DEFAULT 0.15,
  risk_tier VARCHAR(50),         -- LOW, MEDIUM, HIGH
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE account_metrics (
  account_id UUID PRIMARY KEY,
  dau_7d INT,
  mau_30d INT,
  sessions_7d INT,
  unique_features_used INT,
  active_seats INT,
  licensed_seats INT,
  ticket_count INT,
  avg_csat DECIMAL,
  unresolved_p1_tickets INT,
  payment_failures INT,
  plan_downgrades INT,
  last_interaction TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  account_id UUID NOT NULL,
  event_type VARCHAR(100),
  metadata JSONB,
  occurred_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE churn_predictions (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  churn_probability NUMERIC(5, 4),
  risk_tier VARCHAR(50),
  feature_snapshot JSONB,
  shap_values JSONB,
  model_version VARCHAR(50),
  created_at TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR(255),
  condition VARCHAR(500),        -- e.g., "health_score < 50"
  action VARCHAR(500),           -- e.g., "send_slack"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/accounts` | List/create accounts |
| GET/PUT | `/api/accounts/:id` | Get/update account |
| GET | `/api/dashboard/:orgId` | Executive KPI dashboard |
| GET | `/api/predictions/:accountId` | Get churn prediction |
| POST | `/api/predictions/:accountId/compute` | Recompute prediction |
| POST | `/api/events/ingest/:orgId` | Ingest usage events |
| GET | `/api/events/history/:accountId` | Get event timeline |
| GET/POST/PUT | `/api/alerts` | Manage alert rules |

## Performance Targets

- Health score recomputation: < 500ms
- Churn prediction: < 200ms (cached in memory)
- Dashboard KPI retrieval: < 1s (pre-aggregated nightly)
- Event ingestion throughput: 10K+ events/second
- Page load: < 2s (with pre-computed data)

## Testing

```bash
npm test                    # Unit tests
npm run test:integration   # Integration tests
npm run test:load          # k6 load tests
```

## Debugging

```bash
# View event processing
docker logs [aurum_worker_container] -f

# Query account state
psql -h localhost -d aurum -c "SELECT * FROM accounts WHERE org_id = 'org_123';"

# Check Redis event stream
redis-cli XREAD COUNT 10 STREAMS events:org_123 0
```

---

**Last Updated**: March 24, 2026
