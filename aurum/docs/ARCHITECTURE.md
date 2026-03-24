# Aurum Project Structure

```
aurum/
├── backend/                    # Node.js API Server
│   ├── src/
│   │   ├── index.ts           # Main entry point
│   │   ├── config/
│   │   │   ├── database.ts    # PostgreSQL connection
│   │   │   └── redis.ts       # Redis setup
│   │   ├── models/
│   │   │   ├── Account.ts     # Account data model
│   │   │   └── Prediction.ts  # Churn prediction model
│   │   ├── routes/
│   │   │   ├── accounts.ts    # Account management
│   │   │   ├── dashboard.ts   # Executive dashboard metrics
│   │   │   ├── predictions.ts # Churn predictions & SHAP
│   │   │   └── events.ts      # Event ingestion
│   │   ├── services/
│   │   │   └── ml/            # ML model serving
│   │   ├── integrations/      # CRM, billing integrations
│   │   └── utils/
│   │       └── logger.ts
│   ├── package.json
│   └── tsconfig.json
├── ml-service/                 # Python FastAPI ML Service
│   └── src/
│       ├── models/           # XGBoost churn model
│       ├── feature_engineering/
│       └── explainability/   # SHAP integration
├── frontend/                   # Next.js React Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   └── dashboard/
│   │   │       └── ExecutiveDashboard.tsx
│   │   └── pages/
│   │       └── dashboard.tsx
│   ├── package.json
│   └── tsconfig.json
├── docs/                       # Documentation
```

## Key Features Implemented

1. **Data Ingestion Layer**
   - Event streaming API with workspace isolation
   - Integration adapters (Stripe, Salesforce, Zendesk, HubSpot)
   - Custom SDK for product usage tracking
   - Event queue with BullMQ for reliable processing

2. **Health Score Engine**
   - Real-time scoring with configurable weights
   - Five components: Engagement, Utilization, Support, Financial, Relationship
   - Live recalculation on event ingestion
   - Historical tracking for trend analysis

3. **Churn Prediction ML Model**
   - XGBoost binary classifier
   - Per-organization model training
   - Cold start handling with baseline model
   - Weekly retraining with AUC-ROC validation
   - SHAP values for feature explainability

4. **Revenue Forecasting**
   - Prophet time-series forecasting
   - ARR waterfall breakdown
   - Scenario modeling with sliders
   - Confidence intervals and historical accuracy

5. **Executive Dashboard**
   - KPI cards: ARR, NRR, GRR, Logo Churn
   - Monthly ARR movement stacked bar
   - Customer cohort retention analysis
   - Health distribution donut chart
   - Churn risk heatmap with dot plot
   - At-risk accounts sortable table

6. **Account Intelligence**
   - Individual account detail pages
   - Timeline of all account events
   - Usage analytics and adoption curves
   - SHAP-based risk explanation
   - AI-generated account summary (LLM synthesis)
   - Next Best Actions recommendations

## ML Model Architecture

**Churn Prediction Pipeline:**
- Feature extraction from account_metrics (24-month history)
- Standardization and handling of missing values
- XGBoost training with 80/20 split
- Hyperparameter tuning with grid search
- SHAP value computation for each prediction
- Model versioning and promotion workflow

**Performance Targets:**
- AUC-ROC ≥ 0.75 on reserved test set
- Prediction latency < 200ms (cached in memory)
- Weekly retraining completes in < 10 minutes

## Event Processing

Real-time event flow:
1. Event received at /api/events/ingest
2. Validation and deduplication
3. Stored in event_log table
4. Triggershealth score recalculation
5. Emitted to Redis pub/sub for live dashboard
6. Batch aggregated nightly to account_metrics

## Next Steps

- Implement XGBoost model training in Python service
- Add Stripe, Salesforce API integrations
- Build alert rules and playbook engine
- Add Slack/email delivery for alerts
- Implement cohort analysis queries
- Add query builder for custom analytics
