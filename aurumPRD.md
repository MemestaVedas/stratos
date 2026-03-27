# PRD-03: Stratos Aurum
## Multi-Tenant Revenue Intelligence & Predictive Analytics Platform

**Product:** Stratos Aurum  
**Brand:** Stratos Enterprise Intelligence Platform  
**Version:** 1.0  
**Author:** Solo Developer  
**Status:** Draft  
**URL:** stratos.dev/aurum  
**Estimated Build Time:** 3 months  
**Target Role:** Full Stack Developer (FAANG-level)

---

## 1. Executive Summary

### 1.1 Product Vision

Stratos Aurum is a revenue intelligence platform for B2B SaaS companies. It ingests CRM data, product usage telemetry, billing events, and support tickets — then applies ML models to predict customer churn, forecast revenue, and surface expansion opportunities. Every prediction is accompanied by a plain-English explanation of the contributing factors. Real-time event streaming means health scores update live as customers use the product.

Think: Clari + Gainsight + Mixpanel, rebuilt with an ML-first, explainability-first architecture.

### 1.2 Problem Statement

B2B SaaS companies lose revenue to invisible churn: customers quietly disengaging before cancelling. By the time a Customer Success Manager notices, it's too late. Aurum makes churn visible, predictable, and preventable — with ML scores that update in real time and explain their own reasoning.

### 1.3 Strategic Goals

- Demonstrate end-to-end ML platform engineering: feature pipelines, model serving, explainability, retraining
- Show real-time event stream processing: Kafka-inspired ingestion, live health score recalculation
- Prove complex multi-tenant analytics: each customer org sees only their own data with no cross-contamination
- Build a visually impressive executive dashboard that screams "enterprise product"

---

## 2. Multi-Tenancy Model

### 2.1 Tenant Hierarchy

```
Stratos Platform
  └── Organization (e.g., "Linear SaaS")       ← Aurum customer (B2B)
        ├── Accounts (their customers)
        ├── Users (Linear's CS team, AEs, executives)
        ├── Integrations (Salesforce, Stripe, etc.)
        └── ML Models (trained on their data)
```

Aurum's tenants are themselves B2B SaaS companies. Their customers are called **Accounts**. Linear's CS team uses Aurum to monitor and manage their accounts.

### 2.2 Isolation Requirements

- Account data partitioned by `org_id` at every query level
- ML models trained per organization (each org's model trained on their own historical data)
- Usage event ingestion namespaced by `org_id` in the event queue
- No org can access another org's account records, churn scores, or revenue data

### 2.3 Roles

| Role | Permissions |
|---|---|
| Org Owner | Manage billing, integrations, org-wide settings, all data |
| Executive | View-only dashboards: ARR, NRR, churn forecasts, cohort analysis |
| CS Manager | Manage accounts, view all health scores, create playbooks, assign tasks |
| CS Rep | View and update assigned accounts, log activities |
| Developer | Manage integrations, event SDK, API keys |

---

## 3. Feature Specifications

### 3.1 Data Ingestion & Integration Layer

**Priority:** P0 — Platform Foundation

**Integration Sources:**

| Source | Data Collected | Method |
|---|---|---|
| Stripe (sandbox) | MRR, ARR, invoices, payment failures, plan changes, cancellations | Webhook + periodic sync |
| Salesforce CRM (mock) | Account details, contacts, opportunity stage, AE owner | REST API polling |
| Product Usage (custom SDK) | Feature events, session starts, DAU/MAU, feature adoption | JS/Python SDK → REST endpoint |
| Zendesk Support (mock) | Ticket count, CSAT score, ticket severity, time to resolution | REST API polling |
| HubSpot CRM (mock) | Alternative to Salesforce — contacts, deal stage | REST API polling |

**Custom Event SDK:**
```javascript
// @stratos/aurum-sdk — npm package
import { AurumClient } from '@stratos/aurum-sdk';

const aurum = new AurumClient({ 
  apiKey: 'ak_live_...', 
  accountId: customer.id  // the B2B customer's identifier
});

// Track feature usage events
aurum.track('feature_used', { 
  feature: 'advanced_export',
  userId: user.id,
  plan: 'enterprise'
});

// Track session start
aurum.identify(user.id, { 
  name: user.name, 
  role: user.role,
  accountId: customer.id 
});
```

**Event Ingestion Pipeline:**
```
SDK / Webhook → POST /api/v1/ingest/:orgId/events
      │
      ▼
Validate payload + API key
      │
      ▼
Write to BullMQ event queue (Redis-backed)
      │
      ▼
Event processor worker:
  ├── Persist raw event to event_log table
  ├── Update account_metrics aggregation table
  ├── Trigger health score recalculation (async)
  └── Emit to Redis pub/sub → real-time dashboard update
```

**Data Models:**
```
accounts
  id                  UUID PRIMARY KEY
  org_id              UUID REFERENCES organizations(id)
  external_id         VARCHAR         -- ID in CRM/Stripe
  name                VARCHAR
  arr                 DECIMAL(15,2)
  plan                VARCHAR
  mrr                 DECIMAL(15,2)
  contract_start      DATE
  contract_end        DATE
  health_score        FLOAT           -- 0–100, updated in real time
  churn_probability   FLOAT           -- ML prediction, 0–1
  churn_risk_tier     ENUM (healthy, at_risk, high_risk, churned)
  owner_user_id       UUID REFERENCES users(id)
  created_at          TIMESTAMP

usage_events
  id                  BIGSERIAL PRIMARY KEY
  org_id              UUID
  account_id          UUID REFERENCES accounts(id)
  event_name          VARCHAR
  user_id             VARCHAR         -- customer's end user
  properties          JSONB
  occurred_at         TIMESTAMP

account_metrics         -- pre-aggregated for dashboard performance
  account_id          UUID PRIMARY KEY
  org_id              UUID
  dau_7d              INTEGER
  mau_30d             INTEGER
  sessions_7d         INTEGER
  feature_adoption    JSONB           -- { feature_name: adoption_pct }
  support_tickets_30d INTEGER
  avg_csat_90d        FLOAT
  days_since_login    INTEGER
  payment_failures_90d INTEGER
  seat_utilization    FLOAT           -- seats_active / seats_licensed
  last_updated        TIMESTAMP
```

**Acceptance Criteria:**
- Event ingested and reflected in dashboard within 5 seconds (p95)
- Stripe webhook correctly updates MRR on plan upgrade/downgrade
- SDK publishes events in batches (max 50 per request) to reduce API call overhead
- Failed events stored in dead letter queue with retry logic

---

### 3.2 Health Score Engine

**Priority:** P0

**Requirements:**
- Composite health score (0–100) calculated per account from weighted signals
- Score components configurable by org (drag sliders to adjust weights)
- Real-time recalculation: score updates within 5 seconds of new usage event
- Score history: daily snapshot stored, visible as a sparkline on account card
- Score trend: "↑ +12 pts this week" or "↓ -8 pts this week"
- Score explanation: breakdown of each component's contribution to current score

**Default Scoring Components:**

| Signal | Default Weight | Formula |
|---|---|---|
| Product Engagement | 30% | Composite of DAU/MAU ratio, sessions/week, feature breadth |
| Seat Utilization | 20% | active_seats / licensed_seats (penalize < 60%) |
| Support Health | 15% | Penalize high ticket volume, low CSAT, unresolved P1 tickets |
| Financial Health | 20% | Penalize payment failures, downgrade history, upcoming renewal |
| Relationship Health | 15% | Days since last CS touchpoint, executive sponsor engaged? |

**Score Calculation (simplified):**
```python
def calculate_health_score(metrics: AccountMetrics, weights: OrgWeights) -> float:
    engagement = score_engagement(metrics.dau_7d, metrics.mau_30d, metrics.sessions_7d, metrics.feature_adoption)
    utilization = score_utilization(metrics.seat_utilization)
    support = score_support(metrics.support_tickets_30d, metrics.avg_csat_90d)
    financial = score_financial(metrics.payment_failures_90d, metrics.days_to_renewal)
    relationship = score_relationship(metrics.days_since_cs_touchpoint)

    return (
        engagement * weights.engagement +
        utilization * weights.utilization +
        support * weights.support +
        financial * weights.financial +
        relationship * weights.relationship
    ) * 100
```

**Acceptance Criteria:**
- Score recalculates within 5 seconds of triggering usage event
- Weight adjustments immediately recalculate scores for all accounts in the org
- Score explanation breakdown sums to exactly the displayed score
- Score history chart shows correct daily snapshots for last 90 days

---

### 3.3 Churn Prediction ML Model

**Priority:** P0 — The ML centrepiece

**Requirements:**
- Binary classifier: predicts probability of churn within the next 90 days per account
- Algorithm: Gradient Boosted Trees (XGBoost) — industry standard for tabular data
- Features used: all fields in `account_metrics` + plan type + tenure + ARR segment + historical score trend
- Explainability: SHAP values computed per prediction — "This account is 78% likely to churn because: seat utilization dropped from 85% to 41%, 3 payment failures in last 90 days, 0 logins in 14 days"
- Model trained per organization (personalized to each customer's churn patterns)
- Cold start: new orgs use global baseline model until they have ≥ 50 historical churn/renewal events
- Retraining: triggered weekly via cron or manually; new model promoted only if AUC-ROC improves ≥ 2%
- Prediction stored with model version for auditability

**ML Pipeline:**
```
Weekly Retraining Job:
  1. Feature extraction: pull account_metrics for all accounts in org, last 24 months
  2. Label generation: account churned within 90 days of feature snapshot → label=1
  3. Train/val/test split (70/15/15), stratified by churn label
  4. Hyperparameter tuning: 10-trial Optuna search on val set
  5. Evaluate: AUC-ROC, precision, recall, F1 on test set
  6. If AUC-ROC ≥ current model + 2%: promote new model
  7. Log experiment to MLflow: params, metrics, feature importances
  8. Compute SHAP values for all current accounts → store in predictions table

Prediction Service (real-time):
  POST /predict/:orgId/:accountId
  → Load org model from cache
  → Compute features from account_metrics
  → XGBoost predict_proba
  → Compute SHAP explanation
  → Return { churn_prob, risk_tier, shap_explanations }
```

**Data Model — Predictions:**
```
churn_predictions
  id                  UUID PRIMARY KEY
  org_id              UUID
  account_id          UUID REFERENCES accounts(id)
  model_version       VARCHAR
  churn_probability   FLOAT
  risk_tier           ENUM (healthy, at_risk, high_risk)
  predicted_at        TIMESTAMP
  shap_values         JSONB     -- feature → shap_value mapping
  feature_snapshot    JSONB     -- feature values at prediction time
```

**Acceptance Criteria:**
- Model achieves AUC-ROC ≥ 0.75 on synthetic test dataset (document in README)
- SHAP explanations show top 5 contributing features with direction (positive/negative)
- Prediction API responds in < 200ms (model cached in memory)
- Retraining job completes in < 10 minutes for org with 500 accounts

---

### 3.4 Revenue Forecasting

**Priority:** P1

**Requirements:**
- MRR forecast: predict next 3/6/12 months of MRR with confidence intervals
- Forecast components: expansion (upsell/cross-sell pipeline), contraction (downgrades), churn risk-weighted ARR, new business
- Algorithm: Prophet time series model (Facebook) for trend + seasonality detection
- Waterfall chart: current ARR → at-risk ARR (churn prob × ARR) → expected expansions → forecast ARR
- Scenario modelling: "What if we save 50% of high-risk accounts?" — slider input, instant forecast update
- Forecast accuracy tracking: compare last month's forecast to actual MRR → display MAPE

**ARR Waterfall Calculation:**
```
Starting ARR
  - Churn risk ARR (sum of ARR × churn_probability for high_risk accounts)
  - Expected downgrades (accounts with negative seat utilization trend)
  + Expected expansions (accounts with high engagement + low plan utilization)
  + New business pipeline (from CRM opportunity stage → weighted value)
= Forecasted ARR (with ± confidence interval)
```

**Acceptance Criteria:**
- Forecast chart renders in < 1 second (pre-computed nightly)
- Scenario slider instantly updates waterfall chart values (client-side computation)
- Forecast vs. actual comparison shows for all months with complete data

---

### 3.5 Executive Dashboard

**Priority:** P0

**Requirements:**
- KPI header cards: ARR, MRR, NRR (Net Revenue Retention), GRR (Gross Revenue Retention), Logo Churn Rate
- ARR movement chart: monthly stacked bar — new, expansion, contraction, churn
- Customer cohort analysis: retention curves by cohort month — shows which acquisition cohorts retain best
- Health distribution: donut chart — % of ARR in Healthy / At-Risk / High-Risk tiers
- Churn risk heatmap: scatter plot — x-axis = days to renewal, y-axis = churn probability, bubble size = ARR
- Top 10 at-risk accounts table: sorted by (churn_probability × ARR) — the "burning money" list
- NRR trend: rolling 12-month NRR — enterprise benchmark is >120%
- All charts filterable by: time range, ARR segment, plan, account owner

**Key Metric Definitions:**
```
NRR = (Starting ARR + Expansion - Contraction - Churn) / Starting ARR × 100
GRR = (Starting ARR - Contraction - Churn) / Starting ARR × 100
Logo Churn = Accounts churned / Total accounts at start of period × 100
```

**Acceptance Criteria:**
- Executive dashboard loads in < 2 seconds (all metrics pre-aggregated nightly)
- Cohort chart correctly groups accounts by first active month
- Churn risk heatmap correctly plots all accounts (handles 500+ dots without performance issues)

---

### 3.6 Account Intelligence View

**Priority:** P0

**Requirements:**
- Individual account page: the single most important view in Aurum
- Header: account name, ARR, plan, health score (with colour), churn probability (with SHAP explanation)
- Timeline: chronological feed of all events — usage, billing, support, CS touchpoints
- Usage analytics section: DAU/MAU chart, feature adoption bar chart, session frequency heatmap
- Health score history: 90-day sparkline with key event annotations
- SHAP explanation panel: "Why is this account at risk?" — top 5 factors with direction
- AI-generated account summary: LLM synthesizes the last 30 days of signals into a 3-sentence briefing
- Next Best Actions: rule-based suggestions + ML-ranked — "Schedule an EBR", "Offer feature training", "Escalate to AE"
- CS activity log: log touchpoints (call, email, QBR), view history, set follow-up reminders
- Related contacts: list of contacts at the account from CRM with last interaction date

**AI Account Summary Prompt:**
```
Given the following account data for the last 30 days, write a 3-sentence
briefing for a Customer Success Manager. Focus on: trend direction, key
risk signals, and one recommended action.

Account: {name} | ARR: {arr} | Plan: {plan}
Health score trend: {score_30d_ago} → {score_today} ({delta:+.0f} pts)
Key metrics:
  - DAU/MAU: {dau_mau_ratio}
  - Seat utilization: {seat_utilization}%
  - Support tickets (30d): {ticket_count}, avg CSAT: {csat}
  - Days since last login: {days_since_login}
  - Payment failures (90d): {payment_failures}
  - Days to renewal: {days_to_renewal}
Top churn risk factors: {shap_top_factors}
```

**Acceptance Criteria:**
- Account page renders in < 1.5 seconds
- AI summary cached for 4 hours; refreshable on demand
- SHAP explanation correctly maps factor names to human-readable descriptions
- CS activity log entry saves within 1 second

---

### 3.7 Alerting & Playbook Engine

**Priority:** P1

**Requirements:**
- Alert rules: configurable triggers — "Health score drops > 15 points in 7 days", "Churn probability crosses 0.7", "No login in 14 days"
- Alert delivery: in-app notification, email, Slack webhook (configurable per rule)
- Playbooks: define a sequence of actions to trigger when an alert fires — "Step 1: CS rep notified. Step 2: if no response in 2 days, ping manager. Step 3: schedule EBR."
- Playbook progress tracking: see which step each at-risk account is on
- Snooze alerts: dismiss for 7/14/30 days with a note
- Alert history: full log of all fired alerts with resolution status

**Data Model — Alert:**
```
alert_rules
  id                  UUID PRIMARY KEY
  org_id              UUID
  name                VARCHAR
  condition           JSONB     -- { field, operator, value, window_days }
  severity            ENUM (info, warning, critical)
  channels            JSONB     -- { email: bool, slack_webhook: str, in_app: bool }
  playbook_id         UUID REFERENCES playbooks(id)
  is_active           BOOLEAN
  created_at          TIMESTAMP

alert_events
  id                  UUID PRIMARY KEY
  rule_id             UUID REFERENCES alert_rules(id)
  account_id          UUID REFERENCES accounts(id)
  triggered_at        TIMESTAMP
  resolved_at         TIMESTAMP
  snoozed_until       TIMESTAMP
  resolution_note     TEXT
```

**Acceptance Criteria:**
- Alert fires within 60 seconds of triggering condition being met
- Playbook step 1 automatically executes on alert fire
- Snoozing an alert suppresses it from dashboards and re-activates automatically when snooze expires

---

### 3.8 Analytics API

**Priority:** P1

**Requirements:**
- REST API exposing core Aurum metrics for external consumption (BI tools, custom dashboards)
- Authentication: workspace API key
- Key endpoints: account health scores, churn predictions, MRR metrics, cohort data
- Webhook events: emit events when health score changes by > 10 points, churn tier changes, alert fires
- SDK: `@stratos/aurum-sdk` includes query methods as well as event tracking

---

## 4. Architecture

### 4.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                  Next.js Frontend — Aurum UI                     │
│  Executive Dashboard | Account List | Account 360 | Playbooks    │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                Stratos API Gateway (shared)                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│              Aurum Core API (Node.js + TypeScript)                │
│  Accounts | Metrics | Alerts | Playbooks | Forecasts | Analytics  │
└───┬───────────────┬──────────────────┬────────────────┬──────────┘
    │               │                  │                │
PostgreSQL       Redis              BullMQ        ML Service
(accounts,      (health score      (event         (Python FastAPI)
 events,         cache,             processing,    ├── XGBoost models
 predictions,    real-time          alert          ├── SHAP engine
 metrics)        pub/sub)           evaluation,    ├── Prophet forecasting
                                    retraining     └── MLflow tracking
                                    jobs)
```

### 4.2 Real-Time Score Update Flow

```
Usage event arrives at /api/v1/ingest/:orgId/events
      │
      ▼
Event written to BullMQ (high-priority queue)
      │
      ▼
Event processor: persist to usage_events table
      │
      ▼
account_metrics upsert (atomic, single SQL statement)
      │
      ▼
Health score recalculation (Python ML service, async call)
      │
      ▼
New score written to accounts.health_score
      │
      ▼
Emit to Redis pub/sub: channel = "scores:{orgId}:{accountId}"
      │
      ▼
SSE connection on dashboard receives event → UI updates in real time
```

### 4.3 ML Model Storage

```
models/
  ├── global_baseline/
  │     └── xgboost_v1.0.pkl
  └── org_{org_id}/
        ├── xgboost_v1.0.pkl      -- production model
        ├── xgboost_v1.1.pkl      -- candidate model
        └── metadata.json         -- version, AUC-ROC, feature list, trained_at

MLflow tracking server (local): localhost:5000
  - Experiment per org
  - Run per training job
  - Logged: params, metrics, feature importances, model artifact
```

---

## 5. API Design

### 5.1 Core REST Endpoints

```
Accounts
  GET    /api/accounts                    -- with health score, churn prob, filters
  GET    /api/accounts/:id                -- full account 360 data
  PATCH  /api/accounts/:id               -- update owner, plan, contract dates
  GET    /api/accounts/:id/timeline       -- chronological event feed
  GET    /api/accounts/:id/metrics        -- usage, billing, support metrics
  GET    /api/accounts/:id/prediction     -- latest churn prediction + SHAP
  GET    /api/accounts/:id/summary        -- AI-generated briefing (cached)

Metrics & Dashboard
  GET    /api/metrics/arr-movement        -- monthly ARR waterfall data
  GET    /api/metrics/cohort-retention    -- cohort retention matrix
  GET    /api/metrics/nrr                 -- rolling NRR trend
  GET    /api/metrics/health-distribution -- breakdown by tier

Forecasting
  GET    /api/forecast/mrr                -- 12-month MRR forecast
  POST   /api/forecast/scenario           -- custom scenario computation

Alerts
  GET    /api/alert-rules
  POST   /api/alert-rules
  GET    /api/alert-events
  PATCH  /api/alert-events/:id/snooze

Ingestion (public, API key auth)
  POST   /api/v1/ingest/:orgId/events
  POST   /api/v1/ingest/:orgId/batch      -- up to 50 events
```

---

## 6. Tech Stack Summary

| Layer | Technology | Note |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, Recharts/D3 | Complex chart suite |
| API | Node.js 20, Express, TypeScript, Zod | Core service |
| ML Service | Python 3.11, FastAPI, XGBoost, SHAP, Prophet, MLflow | Prediction + retraining |
| Database | PostgreSQL 15 | Primary store |
| Cache | Redis 7 | Scores cache, pub/sub |
| Queue | BullMQ | Event ingestion, jobs |
| LLM | Claude/OpenAI API | Account summaries |
| Testing | Jest, pytest, Playwright | |
| CI/CD | GitHub Actions | |
| Local Dev | Docker Compose, Vite, Turborepo, MLflow local | |

---

## 7. Build Speed Optimizations (Slow PC)

- **Pre-seeded synthetic dataset** — `seed:dev` script generates 50 fake accounts with 6 months of usage events — no real integrations needed during development
- **Cached ML predictions** — in dev mode, predictions served from static fixture file (`MOCK_ML=true`)
- **MLflow local server** — lightweight, runs on port 5000, no cloud dependency
- **Skip retraining on dev** — `SKIP_TRAINING=true` uses pre-trained model artifact from `fixtures/models/`
- **Vite** for frontend HMR — sub-second rebuilds
- **Turborepo** — shared package caching across Meridian/Vektor/Aurum monorepo

---

## 8. Milestones & Timeline

| Month | Focus | Deliverables |
|---|---|---|
| Month 1 | Data Foundation | Multi-tenancy, account data model, event ingestion pipeline, Stripe webhook, health score engine |
| Month 2 | Intelligence Layer | XGBoost churn model + SHAP, real-time score updates via SSE, executive dashboard, account 360 view |
| Month 3 | Advanced Features | Revenue forecasting (Prophet), alerting engine, playbooks, AI account summaries, analytics API |

---

## 9. What This Proves to FAANG Interviewers

- **ML Platform Engineering:** Full pipeline from raw events → feature engineering → model training → SHAP explainability → production serving
- **Real-Time Event Processing:** Kafka-pattern ingestion (with BullMQ), live score recalculation, SSE dashboard updates
- **Complex Analytics:** Cohort analysis, NRR calculation, ARR waterfall, forecast vs. actual — these are real finance/analytics engineering challenges
- **Explainable AI:** SHAP integration shows understanding of model interpretability — increasingly required at FAANG for any customer-facing ML feature
- **Enterprise Product Thinking:** Playbooks, alert snoozing, scenario modelling — shows you understand how real teams use data products

---

## 10. Stratos Platform Integration Points

| Trigger | Action |
|---|---|
| Aurum: account health score drops > 20 pts | → Meridian: trigger "At-Risk Account Workflow" (send email, create task) |
| Aurum: churn tier changes to HIGH_RISK | → Meridian: trigger "Executive Escalation Workflow" (Slack alert, calendar invite) |
| Vektor: knowledge base updated | → Meridian: trigger "Notify CS Team" workflow |
| Meridian: workflow fails | → Aurum: log operational event on affected account |

This cross-product integration is the capstone of the Stratos suite and demonstrates platform thinking at the architectural level.

---

*End of PRD-03: Stratos Aurum*
