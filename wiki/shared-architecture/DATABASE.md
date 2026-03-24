# Database Schema & Migrations

## Overview

Stratos uses three dedicated PostgreSQL databases for complete isolation:

- **meridian_db**: Workflows, nodes, executions, triggers, credentials
- **vektor_db**: Indexes, chunks, embeddings, data sources
- **aurum_db**: Accounts, predictions, events, metrics, alerts

Each database supports multi-tenancy via `org_id` columns.

## Meridian Database Schema

### Workflows Table

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,           -- DAG definition with nodes/edges
  status VARCHAR(50) NOT NULL,         -- draft, published, archived
  published_version INT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_workflows_org_workspace ON workflows(org_id, workspace_id);
CREATE INDEX idx_workflows_status ON workflows(workspace_id, status);
CREATE INDEX idx_workflows_created ON workflows(org_id, created_at DESC);
```

### Workflow Versions Table

```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  definition JSONB NOT NULL,           -- Complete node definitions
  changelog TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_version_workflow_number 
  ON workflow_versions(workflow_id, version_number);
```

### Executions Table

```sql
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  status VARCHAR(50) NOT NULL,         -- QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
  trigger_source VARCHAR(100),         -- manual, webhook, schedule
  input_data JSONB,                    -- Execution input parameters
  output_data JSONB,                   -- Final output
  error_message TEXT,
  duration_ms INT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_executions_workflow ON executions(workflow_id, created_at DESC);
CREATE INDEX idx_executions_status ON executions(org_id, status);
CREATE INDEX idx_executions_created ON executions(org_id, created_at DESC);
```

### Execution Nodes Table

```sql
CREATE TABLE execution_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,       -- From workflow definition
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(50),                  -- PENDING, RUNNING, SUCCEEDED, FAILED
  error_message TEXT,
  duration_ms INT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_execution_nodes_execution 
  ON execution_nodes(execution_id, node_id);
```

### Triggers Table

```sql
CREATE TABLE triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  trigger_type VARCHAR(50) NOT NULL,   -- webhook, schedule, manual
  name VARCHAR(255),
  trigger_config JSONB,                -- Trigger-specific config
  webhook_url VARCHAR(500),            -- For webhook triggers
  webhook_secret VARCHAR(255),         -- HMAC secret
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_triggers_workflow ON triggers(workflow_id);
CREATE INDEX idx_triggers_webhook_url ON triggers(webhook_url);
```

### Credentials Table

```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  credential_type VARCHAR(100) NOT NULL, -- openai, anthropic, zapier, etc
  encrypted_data TEXT NOT NULL,        -- AES-256-GCM encrypted
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX idx_credentials_org_workspace 
  ON credentials(org_id, workspace_id);
```

## Vektor Database Schema

### Indexes Table

```sql
CREATE TABLE indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100) NOT NULL, -- text-embedding-3-small, etc
  embedding_dimension INT NOT NULL,      -- 384, 1536, etc
  status VARCHAR(50) NOT NULL,           -- EMPTY, BUILDING, READY, DEGRADED
  total_chunks INT DEFAULT 0,
  total_embeddings INT DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_indexes_org_workspace ON indexes(org_id, workspace_id);
CREATE INDEX idx_indexes_status ON indexes(workspace_id, status);
```

### Vector Chunks Table (with pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  chunk_number INT NOT NULL,
  content TEXT NOT NULL,
  source_id VARCHAR(255),               -- Source document ID
  source_type VARCHAR(100),             -- github, confluence, slack, etc
  chunk_metadata JSONB,                 -- { page, section, author, etc }
  embedding vector(1536),               -- Embedding vector (size varies by model)
  metadata_indexed BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for efficient semantic search
CREATE INDEX idx_chunks_embedding ON chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_chunks_source ON chunks(source_id);
CREATE INDEX idx_chunks_index ON chunks(index_id);
```

### Data Sources Table

```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES indexes(id),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(100) NOT NULL,    -- github, confluence, notion, slack, web
  connector_config JSONB,               -- Auth, credentials, URL patterns
  ingestion_status VARCHAR(50),         -- IDLE, RUNNING, FAILED, PAUSED
  last_ingestion_at TIMESTAMP,
  next_ingestion_at TIMESTAMP,
  ingest_schedule VARCHAR(100),         -- cron expression
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_data_sources_index ON data_sources(index_id);
```

### Query Logs Table

```sql
CREATE TABLE query_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  index_id UUID NOT NULL,
  query_text VARCHAR(5000),
  embedding_time_ms INT,
  search_time_ms INT,
  rerank_time_ms INT,
  llm_time_ms INT,
  total_time_ms INT,
  chunks_retrieved INT,
  chunks_reranked INT,
  result_quality_score NUMERIC(3, 2),   -- 0-1 rating
  had_results BOOLEAN,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_query_logs_index ON query_logs(index_id, created_at DESC);
CREATE INDEX idx_query_logs_org ON query_logs(org_id, created_at DESC);
```

## Aurum Database Schema

### Accounts Table

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  external_id VARCHAR(255),             -- CRM ID (Salesforce, HubSpot)
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  country VARCHAR(100),
  arr NUMERIC(12, 2) DEFAULT 0,         -- Annual Recurring Revenue
  mrr NUMERIC(12, 2) DEFAULT 0,         -- Monthly Recurring Revenue
  health_score NUMERIC(5, 2) DEFAULT 75,
  churn_probability NUMERIC(5, 4) DEFAULT 0.15,
  risk_tier VARCHAR(50),                -- LOW, MEDIUM, HIGH
  lifecycle_stage VARCHAR(100),         -- onboarding, established, at-risk, churned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_accounts_org ON accounts(org_id);
CREATE INDEX idx_accounts_external_id ON accounts(org_id, external_id);
CREATE INDEX idx_accounts_health ON accounts(org_id, health_score DESC);
CREATE INDEX idx_accounts_churn ON accounts(org_id, churn_probability DESC);
```

### Account Metrics Table

```sql
CREATE TABLE account_metrics (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  dau_7d INT,                           -- Daily Active Users (7-day avg)
  mau_30d INT,                          -- Monthly Active Users
  sessions_7d INT,                      -- Sessions in last 7 days
  session_freq_per_week NUMERIC(5, 2),
  average_session_duration_mins NUMERIC(10, 2),
  unique_features_used INT,
  feature_breadth_percent NUMERIC(5, 2),
  active_seats INT,
  licensed_seats INT,
  utilization_percent NUMERIC(5, 2),
  ticket_count_30d INT,
  avg_csat NUMERIC(3, 2),
  unresolved_p1_tickets INT,
  payment_failures INT,
  plan_downgrades INT,
  plan_upgrades INT,
  days_to_renewal INT,
  last_interaction TIMESTAMP,
  months_active INT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_account_metrics_utilization 
  ON account_metrics(utilization_percent);
```

### Usage Events Table

```sql
CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  account_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,    -- login, feature_used, export, etc
  event_subtype VARCHAR(100),          -- Feature name
  metadata JSONB,                      -- Event-specific data
  user_id VARCHAR(255),                -- End user
  session_id VARCHAR(255),
  properties JSONB,                    -- Custom properties
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_events_account ON usage_events(account_id, occurred_at DESC);
CREATE INDEX idx_usage_events_org ON usage_events(org_id, occurred_at DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
```

### Churn Predictions Table

```sql
CREATE TABLE churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  churn_probability NUMERIC(5, 4) NOT NULL,
  risk_tier VARCHAR(50) NOT NULL,      -- LOW, MEDIUM, HIGH
  feature_snapshot JSONB NOT NULL,     -- Features at prediction time
  shap_values JSONB NOT NULL,          -- Top 5 SHAP factors
  model_version VARCHAR(50) NOT NULL,
  prediction_confidence NUMERIC(5, 4),
  predicted_churn_date DATE,
  is_accurate BOOLEAN,                 -- For model evaluation
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictions_account ON churn_predictions(account_id, created_at DESC);
CREATE INDEX idx_predictions_org ON churn_predictions(account_id, created_at DESC);
```

### Alert Rules Table

```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(100),         -- health_score, churn_probability, etc
  threshold NUMERIC(10, 4),            -- e.g., 50 for health_score < 50
  comparison_op VARCHAR(10),           -- <, >, <=, >=, =, !=
  action_type VARCHAR(100),            -- slack, email, webhook
  action_config JSONB,                 -- Slack channel, email address, etc
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_org ON alert_rules(org_id, is_active);
```

### Alert Triggers Table

```sql
CREATE TABLE alert_triggers (
  id BIGSERIAL PRIMARY KEY,
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  triggered_at TIMESTAMP NOT NULL,
  triggered_value NUMERIC(10, 4),
  sent_notification BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_triggers_rule ON alert_triggers(alert_rule_id, triggered_at DESC);
CREATE INDEX idx_alert_triggers_account ON alert_triggers(account_id, triggered_at DESC);
```

## Common Tables (Shared Across All Databases)

### Organizations Table

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,   -- For URL: stratos.dev/org/acme
  email VARCHAR(255),
  subscription_tier VARCHAR(50),       -- free, pro, enterprise
  api_key_hash VARCHAR(255),           -- Hashed API key
  billing_email VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Workspaces Table

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,          -- org_id/slug must be unique
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_workspace_org_slug ON workspaces(org_id, slug);
```

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  profile_picture_url VARCHAR(500),
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Workspace Members Table

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(100) NOT NULL,          -- org_owner, workspace_admin, editor, viewer
  invited_by UUID,
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_workspace_members_user 
  ON workspace_members(workspace_id, user_id);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  workspace_id UUID,
  user_id UUID,
  action VARCHAR(100),                 -- CREATE, UPDATE, DELETE, EXECUTE
  resource_type VARCHAR(50),           -- workflow, index, account
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

## Migration Examples

### Migration: Add Health Score History

```sql
-- migration_001_audit_table.sql
CREATE TABLE health_score_history (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  health_score NUMERIC(5, 2),
  score_change NUMERIC(5, 2),
  reason VARCHAR(255),
  computed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_score_history_account 
  ON health_score_history(account_id, computed_at DESC);

-- Data migration
INSERT INTO health_score_history (account_id, health_score, computed_at, created_at)
SELECT a.id, a.health_score, NOW(), NOW()
FROM accounts a
WHERE a.deleted_at IS NULL;
```

### Migration: Add Event Streaming

```sql
-- migration_002_event_streaming.sql
CREATE TABLE event_streams (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  stream_name VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  sequence_number BIGSERIAL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_event_streams_org_name 
  ON event_streams(org_id, stream_name, sequence_number);
```

## Backup & Recovery

### Backup Strategy

```bash
#!/bin/bash
# Daily backup with retention

for DB in meridian_db vektor_db aurum_db; do
  BACKUP_FILE="backups/${DB}_$(date +%Y%m%d_%H%M%S).sql"
  
  pg_dump \
    -h $DB_HOST \
    -U $DB_USER \
    -d $DB \
    --format=custom \
    --compress=9 \
    > $BACKUP_FILE
  
  # Upload to S3
  aws s3 cp $BACKUP_FILE s3://backup-bucket/$DB/
  
  # Keep 30 days locally
  find backups -name "${DB}_*" -mtime +30 -delete
done
```

### Recovery

```bash
# List point-in-time recovery options
pg_basebackup -D recovery_backup -P -v

# Restore from backup
pg_restore -h localhost -U user -d aurum_db backup.sql
```

---

**Last Updated**: March 24, 2026
