"""
Stratos Aurum ML Service
FastAPI service for churn prediction (XGBoost + SHAP) and health score recalculation.

In production:
- XGBoost models trained per-org from historical data
- SHAP values computed per prediction
- Prophet time series for revenue forecasting
- MLflow for experiment tracking
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import random
import math
from datetime import datetime

app = FastAPI(
    title="Aurum ML Service",
    description="Churn prediction and health score engine for Stratos Aurum",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Models =====

class AccountFeatures(BaseModel):
    account_id: str
    org_id: str
    dau_7d: float = 0
    mau_30d: float = 0
    sessions_7d: float = 0
    seat_utilization: float = 0
    support_tickets_30d: float = 0
    avg_csat_90d: float = 0
    days_since_login: float = 0
    payment_failures_90d: float = 0
    days_to_renewal: float = 365
    arr: float = 0
    tenure_months: float = 12
    plan_type: str = "professional"


class PredictionResponse(BaseModel):
    account_id: str
    churn_probability: float
    risk_tier: str
    confidence: float
    model_version: str
    shap_explanations: List[Dict]
    predicted_at: str


class HealthScoreRequest(BaseModel):
    account_id: str
    org_id: str
    metrics: Dict
    weights: Optional[Dict] = None


class HealthScoreResponse(BaseModel):
    account_id: str
    score: float
    components: Dict[str, float]
    risk_tier: str
    recommendations: List[str]


class RetrainingRequest(BaseModel):
    org_id: str
    force: bool = False


class RetrainingResponse(BaseModel):
    job_id: str
    status: str
    org_id: str
    message: str


# ===== Churn Prediction =====

def compute_mock_churn_probability(features: AccountFeatures) -> float:
    """
    Simulate XGBoost churn prediction.
    In production: load org-specific XGBoost model and run predict_proba.
    """
    score = 0.0

    # High days since login → higher churn
    if features.days_since_login > 14:
        score += 0.25
    elif features.days_since_login > 7:
        score += 0.12

    # Low seat utilization → higher churn
    if features.seat_utilization < 40:
        score += 0.20
    elif features.seat_utilization < 60:
        score += 0.10

    # Payment failures → higher churn
    score += min(0.25, features.payment_failures_90d * 0.08)

    # High support tickets → higher churn
    if features.support_tickets_30d > 10:
        score += 0.15
    elif features.support_tickets_30d > 5:
        score += 0.08

    # Low CSAT → higher churn
    if features.avg_csat_90d < 3.0:
        score += 0.15
    elif features.avg_csat_90d < 4.0:
        score += 0.05

    # Upcoming renewal with low engagement → higher churn
    if features.days_to_renewal < 60 and features.sessions_7d < 5:
        score += 0.10

    # Low engagement ratio → higher churn
    dau_mau_ratio = (features.dau_7d / 7) / max(1, features.mau_30d / 30) if features.mau_30d > 0 else 0
    if dau_mau_ratio < 0.1:
        score += 0.15
    elif dau_mau_ratio < 0.25:
        score += 0.08

    # Add small random noise to simulate model uncertainty
    noise = random.uniform(-0.05, 0.05)
    score = max(0.01, min(0.99, score + noise))

    return round(score, 3)


def compute_mock_shap_values(features: AccountFeatures, churn_prob: float) -> List[Dict]:
    """
    Simulate SHAP explanations.
    In production: use shap.TreeExplainer on the XGBoost model.
    """
    factors = []

    # Compute each factor's contribution
    if features.days_since_login > 7:
        factors.append({
            "feature": "Days Since Last Login",
            "feature_key": "days_since_login",
            "direction": "increases_churn",
            "contribution": round(min(0.25, features.days_since_login * 0.015), 3),
            "current_value": features.days_since_login,
            "threshold": 7,
            "description": f"No login in {int(features.days_since_login)} days (threshold: 7 days)"
        })

    if features.seat_utilization < 60:
        factors.append({
            "feature": "Seat Utilization Drop",
            "feature_key": "seat_utilization",
            "direction": "increases_churn",
            "contribution": round(max(0.05, (60 - features.seat_utilization) * 0.005), 3),
            "current_value": round(features.seat_utilization, 1),
            "threshold": 60,
            "description": f"Only {round(features.seat_utilization)}% of seats in use (threshold: 60%)"
        })

    if features.payment_failures_90d > 0:
        factors.append({
            "feature": "Payment Failures",
            "feature_key": "payment_failures_90d",
            "direction": "increases_churn",
            "contribution": round(features.payment_failures_90d * 0.08, 3),
            "current_value": features.payment_failures_90d,
            "threshold": 0,
            "description": f"{int(features.payment_failures_90d)} payment failure(s) in last 90 days"
        })

    if features.support_tickets_30d > 5:
        factors.append({
            "feature": "Support Ticket Volume",
            "feature_key": "support_tickets_30d",
            "direction": "increases_churn",
            "contribution": round(min(0.15, features.support_tickets_30d * 0.012), 3),
            "current_value": features.support_tickets_30d,
            "threshold": 5,
            "description": f"{int(features.support_tickets_30d)} tickets in 30 days (healthy: <5)"
        })

    if features.avg_csat_90d > 0 and features.avg_csat_90d < 4.0:
        factors.append({
            "feature": "Low Customer Satisfaction",
            "feature_key": "avg_csat_90d",
            "direction": "increases_churn",
            "contribution": round(max(0.05, (4.0 - features.avg_csat_90d) * 0.08), 3),
            "current_value": round(features.avg_csat_90d, 1),
            "threshold": 4.0,
            "description": f"CSAT score of {round(features.avg_csat_90d, 1)}/5.0 (target: >4.0)"
        })

    if features.sessions_7d > 15:
        factors.append({
            "feature": "Strong Session Activity",
            "feature_key": "sessions_7d",
            "direction": "decreases_churn",
            "contribution": round(-min(0.15, features.sessions_7d * 0.005), 3),
            "current_value": features.sessions_7d,
            "threshold": 10,
            "description": f"{int(features.sessions_7d)} sessions this week — healthy engagement"
        })

    # Sort by absolute contribution
    factors.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return factors[:5]


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Aurum ML Service", "version": "1.0.0"}


@app.post("/predict/{org_id}/{account_id}", response_model=PredictionResponse)
async def predict_churn(org_id: str, account_id: str, features: AccountFeatures):
    """
    Predict churn probability for an account.
    Returns probability, risk tier, and SHAP explanations.
    """
    churn_prob = compute_mock_churn_probability(features)
    shap_values = compute_mock_shap_values(features, churn_prob)

    risk_tier = "healthy" if churn_prob < 0.3 else "at_risk" if churn_prob < 0.7 else "high_risk"
    confidence = round(0.75 + random.uniform(0, 0.2), 3)

    return PredictionResponse(
        account_id=account_id,
        churn_probability=churn_prob,
        risk_tier=risk_tier,
        confidence=confidence,
        model_version="xgboost_v1.0_baseline",
        shap_explanations=shap_values,
        predicted_at=datetime.utcnow().isoformat() + "Z",
    )


@app.post("/health-score/recalculate", response_model=HealthScoreResponse)
async def recalculate_health_score(request: HealthScoreRequest):
    """
    Recalculate health score for an account based on current metrics.
    """
    metrics = request.metrics
    weights = request.weights or {
        "engagement": 0.30,
        "utilization": 0.20,
        "support": 0.15,
        "financial": 0.20,
        "relationship": 0.15,
    }

    # Component scores (0-100)
    engagement = min(100, max(0, (metrics.get("sessions_7d", 0) / 20) * 100))
    utilization = min(100, max(0, metrics.get("seat_utilization", 50)))
    support = min(100, max(0, 100 - metrics.get("support_tickets_30d", 0) * 5))
    financial = min(100, max(0, 100 - metrics.get("payment_failures_90d", 0) * 20))
    relationship = min(100, max(0, 100 - metrics.get("days_since_cs_touchpoint", 30) * 1.5))

    score = round(
        engagement * weights["engagement"]
        + utilization * weights["utilization"]
        + support * weights["support"]
        + financial * weights["financial"]
        + relationship * weights["relationship"]
    )
    score = max(0, min(100, score))

    risk_tier = "healthy" if score >= 75 else "at_risk" if score >= 50 else "high_risk" if score >= 25 else "churned"

    recommendations = []
    if engagement < 50:
        recommendations.append("Schedule product training to boost engagement")
    if utilization < 50:
        recommendations.append("Review seat utilization — consider optimization discussion")
    if support < 50:
        recommendations.append("Address open support tickets — satisfaction is low")
    if financial < 50:
        recommendations.append("Investigate payment failures with billing team")
    if relationship < 50:
        recommendations.append("Schedule an Executive Business Review (EBR)")

    return HealthScoreResponse(
        account_id=request.account_id,
        score=score,
        components={
            "engagement": round(engagement, 1),
            "utilization": round(utilization, 1),
            "support": round(support, 1),
            "financial": round(financial, 1),
            "relationship": round(relationship, 1),
        },
        risk_tier=risk_tier,
        recommendations=recommendations,
    )


@app.post("/retrain/{org_id}", response_model=RetrainingResponse)
async def trigger_retraining(org_id: str, request: RetrainingRequest):
    """
    Trigger model retraining for an organization.
    In production: queues a BullMQ job for the ML training pipeline.
    """
    return RetrainingResponse(
        job_id=f"retrain_{org_id}_{int(datetime.utcnow().timestamp())}",
        status="queued",
        org_id=org_id,
        message="Retraining job queued. Will promote new model only if AUC-ROC improves by >= 2%.",
    )


@app.get("/models/{org_id}/metadata")
async def get_model_metadata(org_id: str):
    """Get current model metadata for an organization."""
    return {
        "org_id": org_id,
        "model_version": "xgboost_v1.0_baseline",
        "algorithm": "XGBoost (Gradient Boosted Trees)",
        "auc_roc": 0.82,
        "precision": 0.78,
        "recall": 0.74,
        "f1_score": 0.76,
        "trained_at": "2026-03-15T00:00:00Z",
        "training_samples": 1200,
        "feature_count": 15,
        "top_features": [
            {"name": "days_since_login", "importance": 0.21},
            {"name": "seat_utilization", "importance": 0.18},
            {"name": "payment_failures_90d", "importance": 0.15},
            {"name": "support_tickets_30d", "importance": 0.12},
            {"name": "dau_mau_ratio", "importance": 0.11},
        ],
        "next_retrain_scheduled": "2026-04-01T03:00:00Z",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
