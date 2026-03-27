# Aurum ML Pipeline Documentation

## Overview

Aurum uses a machine learning pipeline for two core capabilities:
1. **Churn Prediction** — XGBoost binary classifier with SHAP explainability
2. **Health Score Calculation** — Weighted composite scoring engine

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Node.js API  │────▶│ Python ML    │────▶│ PostgreSQL   │
│ (Express)    │     │ (FastAPI)    │     │ (Results)    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│ Redis        │     │ Model Store  │
│ (Pub/Sub)    │     │ (MLflow)     │
└──────────────┘     └──────────────┘
```

## Churn Prediction Model

### Algorithm
- **Model**: XGBoost (Gradient Boosted Trees) binary classifier
- **Target**: Will customer churn within 90 days? (binary Yes/No)
- **Training Data**: 24-month historical customer behavior
- **Retraining**: Monthly automatic retraining per organization
- **Validation**: Model only promoted if AUC-ROC ≥ 0.75

### Input Features (15 features)

| Feature | Type | Description |
|---------|------|-------------|
| `dau_7d` | float | Daily active users (7-day avg) |
| `mau_30d` | float | Monthly active users (30-day avg) |
| `sessions_7d` | float | Session count (past 7 days) |
| `seat_utilization` | float | Active seats / Licensed seats (%) |
| `support_tickets_30d` | int | Support tickets opened (30-day) |
| `avg_csat_90d` | float | Average CSAT score (90-day, 1-5) |
| `days_since_login` | int | Days since last user login |
| `payment_failures_90d` | int | Failed payment attempts (90-day) |
| `days_to_renewal` | int | Days until contract renewal |
| `arr` | float | Annual Recurring Revenue |
| `tenure_months` | int | Months since account creation |
| `dau_mau_ratio` | float | Computed: DAU(7d)/MAU(30d) |
| `feature_breadth` | float | % of product features used |
| `login_trend` | float | Login frequency change (30d vs 60d) |
| `plan_type` | categorical | Current subscription plan tier |

### Outputs

```json
{
  "churn_probability": 0.72,
  "risk_tier": "HIGH",
  "confidence": 0.89,
  "model_version": "xgboost_v1.2.3",
  "predicted_churn_date": "2026-06-24",
  "shap_explanations": [
    {
      "feature": "Seat Utilization Drop",
      "direction": "increases_churn",
      "contribution": 0.35,
      "current_value": 48,
      "threshold": 60
    }
  ]
}
```

### SHAP Explainability
Every prediction includes the top 5 SHAP (SHapley Additive exPlanations) factors:
- **Feature name**: Which metric is driving the prediction
- **Direction**: Whether it increases or decreases churn probability
- **Contribution**: Magnitude of impact (0-1 scale)
- **Current value**: Account's current value for this feature
- **Threshold**: Healthy threshold for comparison

## Health Score Engine

### Components (Weighted)

| Component | Weight | Metrics Used |
|-----------|--------|-------------|
| Engagement | 30% | DAU/MAU ratio, session frequency, feature breadth |
| Utilization | 20% | Seat utilization (active/licensed), API usage |
| Support | 15% | Ticket volume, CSAT, unresolved high-priority |
| Financial | 20% | Payment failures, days to renewal |
| Relationship | 15% | Days since CS touchpoint, EBR cadence |

### Scoring Formula

```
Health Score = Σ(component_score × weight) × 100

Score Range: 0-100
├── 75-100: Healthy (green)
├── 50-74:  At Risk (amber)
├── 25-49:  High Risk (red)
└── 0-24:   Churned (critical)
```

### Score Recalculation
- **Trigger**: New event ingested, or manual recalculation
- **Target latency**: < 5 seconds from event to updated score
- **History**: Scores recorded as daily snapshots for trending

## ML Service API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/predict/{org_id}/{account_id}` | Generate churn prediction |
| `POST` | `/health-score/recalculate` | Recalculate health score |
| `POST` | `/retrain/{org_id}` | Trigger model retraining |
| `GET` | `/models/{org_id}/metadata` | Get model performance metrics |
| `GET` | `/health` | Service health check |

### Running the ML Service

```bash
cd aurum/ml-service
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8001
```

## Model Performance

| Metric | Target | Current |
|--------|--------|---------|
| AUC-ROC | ≥ 0.75 | 0.82 |
| Precision | ≥ 0.70 | 0.78 |
| Recall | ≥ 0.65 | 0.74 |
| F1 Score | ≥ 0.68 | 0.76 |
| Prediction latency | < 500ms | ~200ms |

## Retraining Pipeline

1. **Data extraction**: Pull 24 months of labeled data per org
2. **Feature engineering**: Compute derived features (ratios, trends)
3. **Training**: XGBoost hyperparameter search (Optuna)
4. **Validation**: Hold-out test set AUC-ROC check
5. **Promotion**: Auto-promote only if improvement ≥ 2%
6. **Monitoring**: Track data drift and model decay weekly

---

**Last Updated**: March 27, 2026
