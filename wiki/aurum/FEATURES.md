# Aurum - Feature Specifications

Complete feature documentation for the Aurum revenue intelligence platform.

## Core Features

### 1. Health Score Engine

**Description**: Real-time composite health scoring for customer accounts.

**Key Capabilities**:

#### Health Score Components
- **Engagement (30%)**
  - Daily Active Users (DAU) / Monthly Active Users (MAU) ratio
  - Session frequency per week
  - Feature adoption breadth (% of features used)
  - Login frequency trend
  
- **Utilization (20%)**
  - Active seats / Licensed seats ratio
  - Seat growth trend
  - Feature breadth usage
  - API usage patterns
  
- **Support Quality (15%)**
  - Support ticket volume (count and trend)
  - Customer satisfaction (CSAT) score
  - Unresolved high-priority tickets
  - Support response time
  
- **Financial Health (20%)**
  - Payment failure count and trend
  - Failed payment rate
  - Plan downgrades
  - Revenue growth/contraction
  
- **Relationship Strength (15%)**
  - Days since last CS touchpoint
  - Customer success engagement level
  - Account review frequency
  - Executive sponsorship signals

#### Scoring Logic
```
Health Score = (
  Engagement * 0.30 +
  Utilization * 0.20 +
  Support * 0.15 +
  Financial * 0.20 +
  Relationship * 0.15
) * 100

Score Range: 0-100
- 75+: Healthy
- 50-74: At Risk
- <50: Critical Risk
```

#### Customization
- Per-organization weight adjustment
- Custom component definitions
- Org-specific metric sources
- Configuration versioning

### 2. Churn Prediction

**Description**: ML-powered prediction of customer churn with explainability.

**Features**:

#### ML Model
- **Algorithm**: XGBoost binary classifier
- **Target**: Will customer churn within 90 days? (Yes/No)
- **Training Data**: 24-month historical customer data
- **Retraining**: Monthly automatic retraining
- **Validation**: AUC-ROC ≥ 0.75 required

#### Features (Inputs)
- DAU/MAU ratio (7-day, 30-day averages)
- Session frequency and trends
- Feature adoption metrics
- Seat utilization and movement
- Support ticket volume and sentiment
- Payment failure history
- Plan change history
- Account tenure
- Revenue metrics
- Behavioral signals

#### Outputs
- **Churn Probability**: 0-1 (e.g., 0.72 = 72% churn likelihood)
- **Risk Tier**: LOW (<30%), MEDIUM (30-70%), HIGH (>70%)
- **Predicted Churn Date**: Estimated churn date (90-day window)
- **Confidence Score**: Model confidence in prediction (0-1)
- **SHAP Explanation**: Top 5 contributing factors with their impact

#### SHAP Explainability
Each prediction includes:
```json
{
  "top_factors": [
    {
      "feature": "Seat Utilization Drop",
      "direction": "increases_churn",
      "contribution": 0.35,
      "current_value": 48,
      "threshold": 60
    },
    {
      "feature": "Payment Failures",
      "direction": "increases_churn",
      "contribution": 0.28,
      "current_value": 2,
      "threshold": 0
    }
  ],
  "base_churn_rate": 0.05,
  "predicted_churn_probability": 0.72
}
```

### 3. Executive Dashboard

**Description**: High-level business metrics and account intelligence.

**Features**:

#### Key Performance Indicators (KPIs)
- **Annual Recurring Revenue (ARR)**
  - Current total ARR
  - ARR vs last quarter
  - Trend indicator (up/down/flat)
  
- **Monthly Recurring Revenue (MRR)**
  - Current MRR
  - Monthly growth rate
  
- **Net Revenue Retention (NRR)**
  - Percentage calculation
  - Trend vs previous quarter
  - Target vs actual
  
- **Gross Revenue Retention (GRR)**
  - Churn impact calculation
  - Trend analysis
  
- **Logo Churn Rate**
  - % of customers lost
  - YoY comparison
  - Cohort analysis

#### Visualizations
- **ARR Waterfall**
  - Beginning ARR
  - New business
  - Expansion
  - Contraction
  - Churn
  - Ending ARR
  
- **Health Distribution**
  - Donut chart: Healthy vs At-Risk vs Critical
  - Count and percentage per category
  
- **At-Risk Accounts Table**
  - Account name and ARR
  - Health score and churn probability
  - Days to renewal
  - Recommended action
  - Quick links to account details
  
- **NRR Trend Chart**
  - 12-month historical trend
  - Target line
  - Projection forward

### 4. Account Intelligence

**Description**: Deep insights into individual customer accounts.

**Features**:
- **Account Overview**
  - Basic info: name, industry, employee count
  - Financial: ARR, MRR, contract value
  - Health: score, churn risk, lifecycle stage
  - CSM assignment
  
- **Usage Analytics**
  - DAU/MAU trends
  - Session frequency
  - Feature adoption
  - Node depth (most used features)
  
- **Health Score Timeline**
  - 90-day sparkline with trend
  - Component breakdown over time
  - Inflection points highlighted
  
- **Engagement Activity**
  - Login activity heatmap
  - Feature usage timeline
  - Export activity
  - Data insights
  
- **Support Activity**
  - Ticket history and trends
  - CSAT scores
  - Agent notes
  - Escalation tracking
  
- **Financial Information**
  - Payment history
  - Failed payments
  - Plan change history
  - Contract renewal date
  - Expansion opportunities
  
- **CS Activity Log**
  - Check-in calls scheduled
  - QBR meetings
  - Email campaigns
  - Handoff events
  - Internal notes

### 5. Event Ingestion Pipeline

**Description**: Real-time ingestion of customer usage events.

**Features**:
- **Event Sources**
  - Product usage events
  - Billing events (payments, invoices)
  - Support events (tickets, chat)
  - Integration events (API calls)
  - Custom webhooks
  
- **Event Types**
  - `login`: User session start
  - `feature_used`: Feature activation
  - `export`: Data export
  - `api_call`: API usage
  - `error`: Product error
  - `support_ticket`: Support request
  - `payment_created`: New invoice
  - `payment_failed`: Payment failure
  
- **Throughput**
  - Target: 1K+ events/second per org
  - Vertical scaling to 10K events/second
  - Batch ingestion API for historical data
  
- **Latency**
  - Health score update: < 5 minutes
  - Event processing: < 30 seconds
  - Search index update: < 1 minute
  
- **Reliability**
  - Event deduplication (idempotency keys)
  - Automatic retries with exponential backoff
  - Dead-letter queue for unprocessable events
  - Event replay capability

### 6. Alerting & Notifications

**Description**: Proactive alerts for risky accounts.

**Features**:
- **Alert Rules**
  - Condition-based: Health score < 50
  - Threshold-based: Churn probability > 0.70
  - Trend-based: Health declining 10+ points/week
  - Custom expressions
  
- **Alert Actions**
  - Slack notifications to channels
  - Email to distribution lists
  - Webhook calls (custom integrations)
  - In-app notifications
  
- **Alert Management**
  - Enable/disable rules
  - Adjust thresholds
  - Snooze alerts temporarily
  - Bulk alert creation
  
- **Alert History**
  - View past alerts
  - Confirm resolution
  - Audit trail of actions
  - Effectiveness metrics

### 7. Playbook Automation

**Description**: Automated recommendations for account actions.

**Features**:
- **Playbook Templates**
  - High churn risk playbook
  - Expansion opportunity playbook
  - Support escalation playbook
  - Renewal preparation playbook
  
- **Next Best Actions**
  - AI-generated recommendations
  - Prioritized by impact
  - Resource requirement estimates
  - Success probability forecasts
  
- **Automation Workflows**
  - Automatic CS check-in scheduling
  - Email outreach campaigns
  - Slack notifications
  - Calendar integration
  - CRM sync

### 8. Revenue Forecasting

**Description**: Predictive analytics for revenue outcomes.

**Features**:
- **Churn Forecast**
  - 90-day churn prediction
  - Cohort-based forecasting
  - Confidence intervals
  
- **Expansion Forecast**
  - Accounts at expansion risk (high health)
  - Expansion potential estimation
  - Upsell opportunity identification
  
- **Revenue Forecast**
  - Monthly recurring revenue projection
  - ARR forecast (12-month)
  - Win/loss probability by account
  - Scenario modeling

## Performance Targets

| Metric | Target |
|--------|--------|
| Health score update | < 5 min |
| Event processing | < 30 sec |
| Dashboard load | < 2 sec |
| Prediction recompute | < 1 min |
| Search (account list) | < 1 sec |

## Account Limits

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Accounts | 500 | 50K | Unlimited |
| Events/second | 10 | 100 | 1K+ |
| Historical data | 2 years | 5 years | Unlimited |
| Users | 3 | 50 | Unlimited |
| Custom metrics | 0 | 5 | Unlimited |

---

**Last Updated**: March 24, 2026
