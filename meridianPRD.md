# PRD-01: Stratos Meridian
## Multi-Tenant AI Workflow Orchestration Engine

**Product:** Stratos Meridian  
**Brand:** Stratos Enterprise Intelligence Platform  
**Version:** 1.0  
**Author:** Solo Developer  
**Status:** Draft  
**URL:** stratos.dev/meridian  
**Estimated Build Time:** 3 months  
**Target Role:** Full Stack Developer (FAANG-level)

---

## 1. Executive Summary

### 1.1 Product Vision

Stratos Meridian is an enterprise-grade workflow orchestration engine that allows engineering and operations teams to visually design, version, deploy, and monitor complex multi-step AI agent pipelines. Each node in a workflow can represent an LLM call, a code execution sandbox, an external API integration, a human approval gate, or a data transformation step. Workflows run in isolated, multi-tenant execution environments with full observability — real-time logs, cost tracking, latency breakdowns, and failure replay.

Think: Temporal + LangGraph + Zapier, built from scratch as a B2B SaaS product.

### 1.2 Problem Statement

Enterprise teams building AI-powered automation face a fragmented toolchain: orchestration logic scattered across scripts, no visibility into agent execution, no way to version or roll back workflows, and no multi-tenant isolation between teams. Meridian replaces that chaos with a structured, observable, collaborative platform.

### 1.3 Strategic Goals

- Demonstrate mastery of distributed systems: DAG execution, concurrency control, event-driven architecture
- Show production-grade multi-tenancy: org isolation, RBAC, usage metering
- Prove full-stack AI integration: multi-model routing, prompt versioning, agent observability
- Build a visually impressive product that non-engineers immediately understand

---

## 2. Multi-Tenancy Model

### 2.1 Tenant Hierarchy

```
Stratos Platform
  └── Organization (e.g., "Acme Corp")          ← Billing unit
        ├── Workspace (e.g., "Engineering Team")  ← Isolation boundary
        │     ├── Members (with roles)
        │     ├── Workflows
        │     ├── Credentials (API keys, secrets)
        │     └── Execution Logs
        └── Workspace (e.g., "Data Team")
```

### 2.2 Isolation Requirements

- Workflow execution is fully isolated per workspace — one workspace's runaway execution cannot affect another
- Credentials (API keys, LLM tokens) stored encrypted per workspace, never shared across organizations
- Execution logs partitioned by org_id at the database level
- Rate limiting enforced per workspace (configurable by org admin)
- Usage metering tracked per workspace for billing

### 2.3 Roles

| Role | Permissions |
|---|---|
| Org Owner | Manage billing, create/delete workspaces, manage members |
| Workspace Admin | Create/edit/delete workflows, manage workspace credentials, view all logs |
| Workspace Editor | Create/edit workflows, trigger runs, view own logs |
| Workspace Viewer | View workflows and logs, cannot trigger runs |

---

## 3. Feature Specifications

### 3.1 Visual Workflow Builder (DAG Editor)

**Priority:** P0 — Core Product

**Requirements:**
- Canvas-based drag-and-drop DAG editor built with React Flow
- Nodes connected by edges representing data flow
- Pan, zoom, minimap navigation
- Auto-layout algorithm for complex graphs
- Undo/redo with full history stack (ctrl+z / ctrl+y)
- Copy/paste nodes and subgraphs
- Inline node configuration panel (click node → right panel opens)
- Workflow validation on save: detect cycles, disconnected nodes, missing required config
- Keyboard shortcuts for power users

**Node Types:**

| Node Type | Icon | Description |
|---|---|---|
| Trigger | ⚡ | Starts the workflow (webhook, cron, manual, event) |
| LLM Call | 🤖 | Calls an AI model with a configurable prompt template |
| Code Executor | `{}` | Runs sandboxed JavaScript or Python snippet |
| HTTP Request | 🌐 | Calls an external REST API |
| Data Transform | ⚙️ | Maps, filters, or reshapes data with a JSONata expression |
| Conditional | 🔀 | Branches workflow based on a boolean expression |
| Human Approval | 👤 | Pauses execution, sends approval request, waits for response |
| Sub-Workflow | 📦 | Embeds another workflow as a reusable component |
| Aggregator | 🔗 | Merges outputs from parallel branches |
| Delay | ⏱️ | Waits for a fixed duration or until a datetime |

**Data Flow:**
- Each node receives an `input` object and produces an `output` object
- Downstream nodes reference upstream outputs via template syntax: `{{nodes.summarize.output.text}}`
- Schema inference: after first execution, Meridian infers the shape of each node's output and offers autocomplete in template fields

**Acceptance Criteria:**
- User can build a 10-node workflow in under 5 minutes
- Saving a workflow with a cycle returns a validation error with the offending edge highlighted
- Workflow canvas renders correctly on 13-inch laptop screen at 100% zoom

---

### 3.2 Workflow Versioning & Deployment

**Priority:** P0

**Requirements:**
- Every save creates a new immutable version (semver: auto-increment patch, manual minor/major bump)
- Version history panel: list all versions with timestamp, author, and change summary
- Diff view: side-by-side comparison of any two versions (node additions/removals/config changes highlighted)
- Promote a version to production (replaces currently active version atomically)
- Rollback: one-click revert to any previous version
- Deployment environments: Development, Staging, Production (each with independent active version)
- Canary deployment: route X% of triggers to new version, rest to current (configurable split)

**Data Model — Workflow:**
```
workflows
  id              UUID PRIMARY KEY
  workspace_id    UUID REFERENCES workspaces(id)
  name            VARCHAR(100)
  description     TEXT
  status          ENUM (active, paused, archived)
  created_by      UUID REFERENCES users(id)
  created_at      TIMESTAMP

workflow_versions
  id              UUID PRIMARY KEY
  workflow_id     UUID REFERENCES workflows(id)
  version_number  VARCHAR(20)      -- semver: "1.4.2"
  dag_definition  JSONB            -- full node/edge graph
  created_by      UUID REFERENCES users(id)
  created_at      TIMESTAMP
  change_summary  TEXT

workflow_deployments
  id              UUID PRIMARY KEY
  workflow_id     UUID REFERENCES workflows(id)
  environment     ENUM (development, staging, production)
  version_id      UUID REFERENCES workflow_versions(id)
  canary_version_id UUID           -- null if no canary
  canary_percent  SMALLINT         -- 0–100
  deployed_by     UUID REFERENCES users(id)
  deployed_at     TIMESTAMP
```

**Acceptance Criteria:**
- Deploying a new version to production completes in < 2 seconds with zero downtime
- Canary deployment correctly routes traffic per configured percentage (verified via execution logs)
- Version diff clearly shows which nodes were added, removed, or modified

---

### 3.3 Trigger System

**Priority:** P0

**Trigger Types:**

**Webhook Trigger**
- Each workflow gets a unique HTTPS endpoint: `https://hooks.stratos.dev/meridian/{workspaceId}/{workflowId}`
- HMAC-SHA256 signature verification on all incoming payloads
- Supports GET and POST; payload parsed and injected as workflow input
- Replay button in logs: resend any historical webhook payload to re-trigger execution

**Cron Trigger**
- Standard cron expression (5-field) with timezone support
- Next 5 scheduled runs shown in UI
- Missed run policy: skip, run immediately, or run for each missed interval

**Manual Trigger**
- "Run Now" button in UI with optional JSON input payload
- Useful for testing and ad-hoc execution

**Event Trigger**
- Subscribe to internal Stratos platform events: "new_workflow_run_failed", "health_score_alert" (from Aurum), "index_build_complete" (from Vektor)
- Cross-product integration point — Meridian as the automation layer for the Stratos suite

**Acceptance Criteria:**
- Webhook trigger accepts payload and begins execution within 500ms
- Cron trigger fires within 10 seconds of scheduled time
- Invalid HMAC signature on webhook returns 401 and logs the attempt

---

### 3.4 Execution Engine

**Priority:** P0 — The most technically complex component

**Requirements:**
- DAG-based execution: nodes execute as soon as all their upstream dependencies complete
- Parallel execution: independent branches execute concurrently (worker pool per workspace)
- Node execution timeout: configurable per node (default 30s, max 300s)
- Workflow execution timeout: configurable (default 5 min, max 60 min)
- Retry policy per node: fixed delay, exponential backoff, max attempts (configurable)
- Dead letter queue: failed executions after max retries stored for manual inspection and replay
- Execution state machine: QUEUED → RUNNING → COMPLETED | FAILED | TIMED_OUT | CANCELLED
- Sandboxed code execution: JavaScript runs in isolated VM (Node.js `vm2`), Python in restricted subprocess
- Input/output size limits: 1MB per node to prevent memory overflow

**Execution Architecture:**
```
Trigger fires
      │
      ▼
Execution record created (QUEUED)
      │
      ▼
Job enqueued in BullMQ
      │
      ▼
Worker picks up job
      │
      ▼
Topological sort of DAG → execution plan
      │
      ▼
For each wave of parallel nodes:
  ├── Spawn concurrent node executors
  ├── Each executor: resolve inputs → run node logic → store output
  ├── Stream execution events to Redis pub/sub
  └── On failure: check retry policy → retry or mark FAILED
      │
      ▼
All nodes complete → mark execution COMPLETED
      │
      ▼
Emit completion event → trigger downstream workflows if configured
```

**Acceptance Criteria:**
- 10-node workflow with 3 parallel branches completes in < 5 seconds (excluding external API latency)
- Node timeout correctly terminates long-running code executor and marks node TIMED_OUT
- Retry with exponential backoff: 3 attempts at 1s, 2s, 4s delays verified in execution logs
- Sandbox prevents file system access and network calls outside allowed domains

---

### 3.5 LLM Node — Multi-Model Routing

**Priority:** P0

**Requirements:**
- Supported models: GPT-4o, GPT-3.5-turbo, Claude 3.5 Sonnet, Claude 3 Haiku, Gemini 1.5 Pro
- Model selector dropdown in node config
- Prompt template editor with syntax highlighting and variable interpolation preview
- System prompt + user prompt fields separately configurable
- Temperature, max_tokens, top_p configurable per node
- Structured output mode: define a JSON schema → model response validated against it
- Prompt versioning: prompts are versioned alongside the workflow version
- Cost estimation: estimated token cost shown before execution (based on model pricing)
- Fallback model: if primary model fails/times out, automatically retry with fallback model

**Acceptance Criteria:**
- Switching models in node config requires no other changes to workflow
- Structured output mode rejects responses that don't conform to schema and retries up to 2 times
- Token cost estimate within 15% of actual cost after execution

---

### 3.6 Real-Time Execution Dashboard

**Priority:** P0

**Requirements:**
- Live execution view: as a workflow runs, nodes light up in real time (green = running, tick = complete, red = failed)
- Execution timeline: Gantt-style chart showing each node's start time, duration, and status
- Live log stream: structured log entries stream to the UI in real time via SSE
- Each log entry shows: timestamp, node name, log level, message, and optional JSON payload
- Execution detail panel: click any completed node to see its exact input, output, latency, tokens used, cost
- Active executions list: org-wide view of all currently running workflows (Workspace Admin+)
- Execution history: paginated list with search and filter by status, date, workflow, trigger type
- Metrics summary cards: total executions today, success rate, avg duration, total AI cost this month

**Real-Time Architecture:**
```
Node executor emits events → Redis pub/sub channel (per execution_id)
                                    │
                              SSE endpoint
                            (GET /api/executions/:id/stream)
                                    │
                            Browser EventSource
                                    │
                            React state update → canvas node highlight
```

**Acceptance Criteria:**
- Canvas node highlight updates within 200ms of node state change
- Log stream handles 100 log entries/second without UI jank
- Execution detail panel shows complete I/O data for every node

---

### 3.7 Credentials & Secret Management

**Priority:** P0

**Requirements:**
- Workspace-level credential store for API keys, OAuth tokens, and connection strings
- Credentials referenced in nodes by name (e.g., `{{credentials.OPENAI_KEY}}`) — never hardcoded in workflow definition
- All credentials encrypted at rest (AES-256-GCM, per-workspace key derived from master key)
- Credentials never returned in API responses — write-only after creation
- Credential health check: test connectivity (e.g., ping the API with the stored key) without revealing the key
- Audit log entry created on every credential read during execution

---

### 3.8 Developer API & SDK

**Priority:** P1

**Requirements:**
- REST API for all platform operations: trigger workflows, fetch execution results, manage workflows programmatically
- API key authentication (workspace-scoped, revocable)
- API playground in-browser: test any endpoint with your workspace's API key
- OpenAPI 3.0 spec auto-generated and published at `stratos.dev/meridian/docs`
- TypeScript SDK (`@stratos/meridian-sdk`) published to npm: `client.workflows.trigger(id, payload)`
- Webhook SDK: `@stratos/meridian-webhooks` for verifying incoming webhook signatures

---

## 4. Architecture

### 4.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│              Next.js Frontend — Meridian UI                      │
│   DAG Editor (React Flow) | Execution Dashboard | Log Viewer     │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│               Stratos API Gateway (shared)                        │
│         Auth validation | Rate limiting | Org routing             │
└────┬──────────────┬──────────────────────────────────────────────┘
     │              │
┌────▼────┐  ┌──────▼──────────────────────────────────────────┐
│  SSE    │  │         Meridian Core API (Node.js)              │
│ Stream  │  │  Workflows | Triggers | Executions | Credentials  │
│ Server  │  └──┬──────────────┬────────────────────┬───────────┘
└────┬────┘     │              │                    │
     │       PostgreSQL     BullMQ              Redis
     │       (workflows,    (execution          (pub/sub,
     └───────executions,     job queue)          SSE events,
             logs)                               rate limiting)
                                │
                         Worker Pool (Node.js)
                         ├── Node Executors
                         ├── Code Sandbox (vm2 / subprocess)
                         └── LLM Router → OpenAI / Anthropic / Google
```

### 4.2 Key Technical Decisions

**Decision 1: BullMQ for execution queue vs. custom queue**
- BullMQ chosen for battle-tested priority queues, delayed jobs, retry logic, and job events
- Tradeoff: Redis dependency, but Redis already used for pub/sub and caching
- At scale: replace with Temporal for durable execution with built-in state persistence

**Decision 2: Node.js workers vs. separate execution microservice**
- Node.js workers in same service for simplicity at this scale
- Architecture designed so workers can be extracted to a separate Kubernetes Deployment with zero code changes
- Tradeoff: noisy neighbour risk mitigated by per-workspace rate limiting on the queue

**Decision 3: React Flow vs. custom canvas**
- React Flow provides production-grade pan/zoom/select/connect primitives
- Custom node rendering still allows full visual control
- Tradeoff: adds ~150KB to bundle, mitigated by code-splitting the editor page

---

## 5. API Design

### 5.1 Core Endpoints

```
Workflows
  GET    /api/workflows
  POST   /api/workflows
  GET    /api/workflows/:id
  PUT    /api/workflows/:id
  DELETE /api/workflows/:id
  GET    /api/workflows/:id/versions
  POST   /api/workflows/:id/versions/:versionId/deploy

Executions
  POST   /api/workflows/:id/trigger
  GET    /api/executions
  GET    /api/executions/:id
  GET    /api/executions/:id/stream          -- SSE
  POST   /api/executions/:id/cancel
  POST   /api/executions/:id/replay

Credentials
  GET    /api/credentials
  POST   /api/credentials
  DELETE /api/credentials/:id
  POST   /api/credentials/:id/test

Triggers
  GET    /api/workflows/:id/triggers
  POST   /api/workflows/:id/triggers
  DELETE /api/workflows/:id/triggers/:triggerId

Webhook receiver (public, no auth)
  POST   /hooks/:workspaceId/:workflowId
```

---

## 6. Tech Stack Summary

| Layer | Technology | Note |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, React Flow | DAG editor |
| API | Node.js 20, Express, TypeScript, Zod | Core service |
| Execution Workers | Node.js, BullMQ | Separate worker process |
| Code Sandbox | vm2 (JS), restricted subprocess (Python) | Security critical |
| Database | PostgreSQL 15 | Primary store |
| Queue & Cache | Redis 7, BullMQ | Execution queue + pub/sub |
| LLM Integration | OpenAI SDK, Anthropic SDK | Multi-model router |
| Testing | Jest, Supertest, Playwright | Unit + E2E |
| CI/CD | GitHub Actions | Build + test + deploy |
| Local Dev | Docker Compose, Vite, Turborepo | Fast rebuild |

---

## 7. Build Speed Optimizations (Slow PC)

- **Vite** for frontend dev server — sub-second HMR
- **Turborepo** — only rebuilds changed packages in the monorepo
- **Docker Compose profiles** — `docker compose --profile meridian up` starts only Meridian's services
- **SQLite** for local dev (Prisma supports both; swap via `DATABASE_URL` env var)
- **Mock LLM responses** — fixture-based mock for all LLM calls in dev mode (`MOCK_LLM=true`)
- **Disable source maps** in dev — faster build, still readable via original source

---

## 8. Milestones & Timeline

| Month | Focus | Deliverables |
|---|---|---|
| Month 1 | Core Platform | Auth, multi-tenancy, DAG editor (React Flow), workflow CRUD, versioning |
| Month 2 | Execution Engine | BullMQ workers, node executors, LLM router, real-time SSE stream, execution logs |
| Month 3 | Polish & API | Canary deployments, credential vault, developer API + SDK, observability dashboard |

---

## 9. What This Proves to FAANG Interviewers

- **Distributed Systems:** DAG execution engine, job queues, retry policies, dead letter queues
- **Real-Time Engineering:** SSE streaming from worker → Redis pub/sub → browser canvas
- **Multi-Tenancy at Depth:** Not just row-level filtering — isolated execution environments, encrypted credential stores, usage metering
- **AI Engineering:** Multi-model routing, prompt versioning, structured outputs, cost tracking
- **Product Thinking:** Canary deployments, diff views, approval gates — features that show you understand how real teams work

---

*End of PRD-01: Stratos Meridian*
