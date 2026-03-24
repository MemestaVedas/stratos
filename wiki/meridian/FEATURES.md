# Meridian - Feature Specifications

Complete feature documentation for the Meridian workflow orchestration engine.

## Core Features

### 1. Visual DAG Editor

**Description**: Drag-and-drop interface for designing workflow DAGs without code.

**Key Capabilities**:
- Multi-node workflow creation (up to 500 nodes per workflow)
- 10+ node types with visual differentiation
- Real-time canvas rendering with zoom/pan
- Node configuration panel for settings
- Auto-save with version history
- Undo/redo support

**Node Types**:

#### Trigger Nodes
- **Webhook**: Receive HTTP POST requests
  - Custom URL generation
  - HMAC signature verification
  - Rate limiting per webhook
  
- **Schedule**: Time-based triggers (cron expressions)
  - Support for: minutes, hours, days, months
  - Timezone-aware scheduling
  - Execution history and missed runs tracking

- **Manual**: Human-initiated triggers
  - Custom input form generation
  - Approval workflow integration
  - Run history tracking

#### Action Nodes
- **LLM**: Call large language models
  - Model selection (GPT-4, GPT-3.5, Claude, etc)
  - Prompt templating with variable substitution
  - Token usage tracking
  - Multi-model routing based on cost/latency
  
- **Code**: Execute custom code (Python, JavaScript)
  - Sandboxed execution environment
  - 5-minute timeout limit
  - Package availability (common libraries included)
  - Execution logs and error details
  
- **HTTP**: Make REST API calls
  - Auth support (API key, OAuth, Basic)
  - Request/response transformation
  - Retry logic with exponential backoff
  - Timeout configuration
  
- **Database**: Direct database operations
  - SQL query execution
  - Connection pooling
  - Result transformation
  - Transaction support

- **Webhook**: Call external webhooks
  - Custom headers
  - Payload transformation
  - Timeout and retry settings
  
#### Control Flow Nodes
- **Condition**: Branching logic
  - Boolean expressions
  - Switch/case statements
  - Multiple output branches
  
- **Merge**: Combine multiple branches
  - Merge strategy selection
  - Data aggregation options
  
- **Loop**: Iterate over arrays
  - Array input selection
  - Iteration limit (max 1000)
  - Break/continue support

#### Data Nodes
- **Transform**: Data transformation
  - JSONPath expressions
  - Built-in functions
  - Custom transformation code
  
- **Aggregate**: Combine data from multiple inputs
  - Merge strategies (concat, merge, distinct)
  - Aggregation functions (sum, avg, count)

### 2. Workflow Execution Engine

**Description**: Reliable, scalable execution of workflows with comprehensive logging.

**Features**:
- **Execution Status Tracking**
  - QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED
  - Real-time status updates via WebSocket
  - Detailed execution logs per node
  
- **Node Execution**
  - Topological execution order
  - Parallel execution where possible
  - Individual node timeout: 5 minutes
  - Execution result caching for re-runs
  
- **Error Handling**
  - Automatic retry policies
  - Manual retry support
  - Graceful degradation
  - Dead-letter queue for failed executions
  
- **Performance**
  - Median execution time: 200-500ms
  - Support for 10K+ concurrent executions
  - Execution result retention: 30 days
  - Archived execution history: 1 year

### 3. LLM Integration

**Description**: First-class support for large language model nodes with advanced routing.

**Features**:
- **Multi-Model Support**
  - OpenAI: GPT-4, GPT-3.5-turbo
  - Anthropic: Claude 3 Opus, Sonnet, Haiku
  - Google: Gemini Pro
  - Fallback routing if primary model unavailable
  
- **Advanced Routing**
  - Cost-based routing: Select cheapest model for task
  - Latency-based routing: Select fastest model
  - Quality-based routing: Route to best performing model
  - Custom routing logic via conditions
  
- **Token Optimization**
  - Token usage tracking per execution
  - Prompt caching for repeated queries
  - Cost attribution per workflow
  - Budget alerts and limits
  
- **Prompt Management**
  - Template variables: {{input}}, {{result_from_node}}
  - System prompts and context injection
  - Few-shot example management
  - Version control for prompts

### 4. Webhook Triggers

**Description**: Receive and process external events with verification.

**Features**:
- **Webhook Creation**
  - Auto-generated unique URL per trigger
  - Custom webhook paths supported
  - Path-based routing for multiple triggers
  
- **Security**
  - HMAC-SHA256 signature verification
  - Rate limiting (per IP, per webhook)
  - IP whitelisting
  - Webhook secret rotation
  
- **Request Processing**
  - JSON payload support
  - Form-encoded data
  - Custom header extraction
  - Automatic retry of failed events
  
- **Monitoring**
  - Webhook call logs with timestamps
  - Success/failure rates
  - Latency metrics
  - Payload inspection interface

### 5. Version Control

**Description**: Track workflow changes and support easy rollback.

**Features**:
- **Automatic Versioning**
  - New version on every publish
  - Changelog documentation
  - Published vs draft separation
  - Version numbering (v1, v2, etc)
  
- **Rollback**
  - One-click rollback to previous version
  - Version comparison interface
  - Execution history by version
  
- **Change Tracking**
  - What changed (node added/removed/modified)
  - Who made the change
  - When it was changed
  - Change description/changelog

### 6. Credential Management

**Description**: Secure storage and management of API keys and secrets.

**Features**:
- **Encryption**
  - AES-256-GCM encryption at rest
  - TLS 1.3 in transit
  - Per-credential encryption keys
  
- **Organization of Credentials**
  - Categorization by type (OpenAI, Stripe, custom)
  - Description and metadata
  - Expiration tracking
  - Usage metrics
  
- **Access Control**
  - Workspace-level credential sharing
  - Audit trail of credential access
  - Masking in UI (show only first/last 4 chars)
  
- **Rotation**
  - Credential rotation scheduling
  - Automatic notification before expiry
  - Multiple credential versions
  - Seamless switchover during rotation

### 7. Real-Time Monitoring Dashboard

**Description**: Live monitoring of workflow executions.

**Features**:
- **Execution Overview**
  - Live execution list with status
  - Filter by workflow, status, date range
  - Search by execution ID, input parameters
  - Sort by start time, duration, status
  
- **Execution Details**
  - Node-by-node execution timeline
  - For each node: input, output, duration, status
  - Error messages and stack traces
  - Token/cost attribution
  
- **Metrics & Analytics**
  - Total executions per day/week/month
  - Success rate percentage
  - Average execution duration
  - Peak execution times
  - Node popularity (most used nodes)
  
- **Alerts**
  - High failure rate alerts
  - Slow execution alerts
  - Budget overspend alerts
  - Custom alerting rules

### 8. Execution Logs

**Description**: Comprehensive logging of all execution details.

**Features**:
- **Log Levels**
  - DEBUG: Detailed diagnostic information
  - INFO: General workflow progress
  - WARN: Potential issues (retries, degraded service)
  - ERROR: Failures and exceptions
  
- **Structured Logging**
  - JSON format for machine parsing
  - Timestamp, execution ID, node ID in all logs
  - Request tracing across distributed calls
  
- **Log Retention**
  - 30 days hot storage (fast access)
  - 90 days warm storage (slower access)
  - 1 year cold storage (archive)
  - Searchable via ELK stack integration

## Performance Targets

| Metric | Target |
|--------|--------|
| Workflow creation | < 100ms |
| Execution start | < 500ms |
| Node execution (avg) | < 100ms |
| Dashboard load | < 1s |
| Webhook delivery | < 5s |

## Usage Limits

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Workflows | 5 | 100 | Unlimited |
| Executions/day | 100 | 10K | Unlimited |
| Nodes per workflow | 50 | 200 | 500 |
| Concurrent executions | 5 | 50 | 500 |

---

**Last Updated**: March 24, 2026
