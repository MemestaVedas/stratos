# PRD-02: Stratos Vektor
## Real-Time Semantic Search & Knowledge Intelligence Platform

**Product:** Stratos Vektor  
**Brand:** Stratos Enterprise Intelligence Platform  
**Version:** 1.0  
**Author:** Solo Developer  
**Status:** Draft  
**URL:** stratos.dev/vektor  
**Estimated Build Time:** 3 months  
**Target Role:** Full Stack Developer (FAANG-level)

---

## 1. Executive Summary

### 1.1 Product Vision

Stratos Vektor is a B2B SaaS platform that lets engineering and product teams ingest any data source — documents, codebases, databases, Confluence spaces, GitHub repositories — build a semantic search layer on top of it, and query that layer through a natural language chat interface or a REST API. Each organization gets fully isolated vector namespaces, configurable chunking and embedding pipelines, real-time ingestion observability, and query analytics.

Think: Pinecone + Langchain + an enterprise UI, built as a product.

### 1.2 Problem Statement

Enterprise teams drowning in internal knowledge (wikis, runbooks, codebases, PDFs) can't find anything. Semantic search solves this, but setting it up requires stitching together vector databases, embedding APIs, chunking logic, and retrieval pipelines — none of which have a UI. Vektor productizes the entire stack.

### 1.3 Strategic Goals

- Demonstrate mastery of the modern AI infrastructure stack: embeddings, vector search, RAG, chunking strategies
- Show real-time data pipeline engineering: ingestion progress, live indexing status, error recovery
- Prove multi-tenant platform design at the infrastructure level: namespace isolation, per-org embedding model config
- Build the kind of internal tooling that every AI-forward company at FAANG scale actually needs

---

## 2. Multi-Tenancy Model

### 2.1 Tenant Hierarchy

```
Stratos Platform
  └── Organization (e.g., "Stripe Engineering")
        ├── Workspace (e.g., "Platform Team")
        │     ├── Indexes (isolated vector namespaces)
        │     ├── Data Sources (connectors)
        │     ├── API Keys
        │     └── Query Analytics
        └── Workspace (e.g., "Customer Success")
```

### 2.2 Isolation Model

- Each Index maps to an isolated namespace in the vector store (pgvector schema-per-workspace or Qdrant collection-per-workspace)
- No cross-workspace vector queries possible at the API level
- Embedding model API keys stored encrypted per workspace
- Query logs partitioned by org_id; no cross-org analytics possible

### 2.3 Roles

| Role | Permissions |
|---|---|
| Org Owner | Manage billing, workspaces, SSO configuration |
| Workspace Admin | Create/delete indexes, manage connectors, view all analytics |
| Workspace Editor | Add data sources, trigger re-indexing, run queries |
| API Consumer | Query-only access via API key |

---

## 3. Feature Specifications

### 3.1 Index Management

**Priority:** P0 — Core Concept

An **Index** is Vektor's central resource: a named, versioned, queryable vector namespace built from one or more data sources.

**Requirements:**
- Create an index with a name, description, and embedding model selection
- Index configuration: embedding model, chunk size, chunk overlap, distance metric (cosine, euclidean, dot product)
- Index status: EMPTY → BUILDING → READY → DEGRADED (if a source fails re-sync)
- Multiple data sources can feed a single index
- Index statistics: total chunks, total tokens, total documents, last updated, estimated storage
- Index versioning: create a new version from a snapshot (enables safe re-indexing without downtime)
- Delete index: soft delete with 7-day recovery window

**Data Model — Index:**
```
indexes
  id                UUID PRIMARY KEY
  workspace_id      UUID REFERENCES workspaces(id)
  name              VARCHAR(100)
  description       TEXT
  embedding_model   VARCHAR         -- e.g., "openai/text-embedding-3-small"
  chunk_size        INTEGER DEFAULT 512
  chunk_overlap     INTEGER DEFAULT 50
  distance_metric   ENUM (cosine, euclidean, dot_product) DEFAULT cosine
  status            ENUM (empty, building, ready, degraded, deleted)
  total_chunks      INTEGER DEFAULT 0
  total_tokens      BIGINT DEFAULT 0
  total_documents   INTEGER DEFAULT 0
  last_built_at     TIMESTAMP
  created_by        UUID REFERENCES users(id)
  created_at        TIMESTAMP

index_versions
  id                UUID PRIMARY KEY
  index_id          UUID REFERENCES indexes(id)
  snapshot_at       TIMESTAMP
  chunk_count       INTEGER
  notes             TEXT
```

**Acceptance Criteria:**
- Index creation with configuration completes in < 1 second (no data ingested yet)
- Deleting an index with active API keys returns a warning requiring confirmation
- Index statistics update within 30 seconds of ingestion job completing

---

### 3.2 Data Source Connectors

**Priority:** P0

**Supported Connector Types:**

| Connector | Auth Method | Sync Strategy |
|---|---|---|
| File Upload | N/A | Manual upload (PDF, DOCX, MD, TXT, CSV) |
| Website / URL | N/A | Crawl up to 100 pages, configurable depth |
| GitHub Repository | OAuth2 / PAT | Full clone + incremental on push webhook |
| Confluence Space | API Token | Full sync + scheduled incremental |
| Notion Database | OAuth2 | Full sync + scheduled incremental |
| PostgreSQL Table | Connection string | Full sync + scheduled (SQL query configurable) |
| REST API Endpoint | API Key / Bearer | Scheduled pull, response mapped to text via JSONata |
| Plain Text / JSON | N/A | Paste directly in UI |

**Connector Data Model:**
```
data_sources
  id                UUID PRIMARY KEY
  index_id          UUID REFERENCES indexes(id)
  connector_type    VARCHAR         -- github, confluence, file, url, etc.
  name              VARCHAR(100)
  config            JSONB           -- connector-specific config (encrypted sensitive fields)
  sync_schedule     VARCHAR         -- cron expression or null (manual only)
  last_synced_at    TIMESTAMP
  status            ENUM (idle, syncing, error, disabled)
  error_message     TEXT
  document_count    INTEGER
  created_at        TIMESTAMP

sync_jobs
  id                UUID PRIMARY KEY
  data_source_id    UUID REFERENCES data_sources(id)
  started_at        TIMESTAMP
  completed_at      TIMESTAMP
  status            ENUM (running, completed, failed, cancelled)
  documents_added   INTEGER
  documents_updated INTEGER
  documents_removed INTEGER
  chunks_generated  INTEGER
  tokens_consumed   BIGINT
  error_details     JSONB
```

**Acceptance Criteria:**
- File upload connector accepts PDF up to 50MB and begins chunking within 5 seconds
- GitHub connector fetches all `.md` and `.txt` files from default branch on first sync
- Failed connector shows last error message with timestamp; retry button available
- Disabling a connector stops future syncs but preserves existing indexed content

---

### 3.3 Ingestion Pipeline

**Priority:** P0 — The technical core of Vektor

**Pipeline Stages:**

```
Data Source → Extract → Clean → Chunk → Embed → Store → Index Update

Stage 1: Extract
  - Connector-specific extraction (PDF text, HTML parse, code file read, DB query)
  - Output: raw Document objects { source_url, raw_text, metadata }

Stage 2: Clean
  - Strip HTML tags, normalize whitespace
  - Language detection (skip non-English if configured)
  - PII detection (flag documents containing emails/SSNs — optional)
  - Deduplication: SHA-256 hash of cleaned content; skip if hash already indexed

Stage 3: Chunk
  - Configurable strategy: fixed-size (default), sentence-boundary, paragraph, semantic (LLM-assisted)
  - Apply chunk_size and chunk_overlap from index config
  - Preserve metadata: source_url, page_number, section_heading, created_at

Stage 4: Embed
  - Batch chunks (max 100 per API call for efficiency)
  - Call embedding model API (OpenAI, Cohere, or local model via Ollama)
  - Retry failed batches with exponential backoff
  - Track token consumption per batch

Stage 5: Store
  - Upsert embeddings + metadata into pgvector
  - Update document and chunk counts on index record
  - Emit progress events to Redis pub/sub

Stage 6: Index Update
  - Refresh HNSW index in pgvector for new vectors
  - Update index.status to READY
  - Notify workspace members via in-app notification
```

**Chunking Strategies:**

| Strategy | Best For | Tradeoff |
|---|---|---|
| Fixed-size | General purpose, fast | May split mid-sentence |
| Sentence-boundary | Prose documents | Uneven chunk sizes |
| Paragraph | Structured documents | Large variance in size |
| Semantic (LLM) | High-accuracy retrieval | Slow, expensive |

**Acceptance Criteria:**
- 100-page PDF fully ingested (extracted, chunked, embedded, stored) within 3 minutes
- Deduplication correctly skips re-ingesting an unchanged document on re-sync
- Token consumption tracked accurately per sync job (within 2% of actual API usage)
- Pipeline continues processing remaining documents if one document fails (fault isolation)

---

### 3.4 Real-Time Ingestion Dashboard

**Priority:** P0

**Requirements:**
- Live progress bar per sync job: documents processed / total, chunks generated, estimated time remaining
- Per-stage breakdown: time spent in Extract, Clean, Chunk, Embed, Store stages
- Live log stream: ingestion events streamed via SSE — `[10:32:14] Chunked "deployment-guide.pdf" into 47 chunks`
- Error log: failed documents listed with error reason and retry option
- Throughput metrics: documents/min, chunks/min, tokens/min — live sparkline charts
- Historical sync jobs: paginated list with duration, documents processed, tokens consumed, status
- Estimated cost: tokens consumed × embedding model price = $ cost per sync job

**Acceptance Criteria:**
- Progress bar updates at minimum every 5 seconds during active sync
- Error log shows at least the document name and error type for every failure
- Estimated cost shown within 10% of actual API invoice

---

### 3.5 Query Interface — Natural Language Search

**Priority:** P0

**Requirements:**
- Chat-style interface for querying an index in natural language
- Query flow: embed query → cosine similarity search → retrieve top-K chunks → LLM synthesis → streamed answer
- Source citations: every answer includes clickable citations to the source documents/chunks used
- Configurable retrieval parameters: top-K (1–20), similarity threshold (0.0–1.0), reranking (on/off)
- Reranking: after initial retrieval, use a cross-encoder model to rerank results for higher precision
- Conversation memory: maintain last 5 turns of context per session
- Query mode toggle: "Answer" (LLM synthesis) vs. "Search" (raw chunk results, no LLM)
- Export conversation: download Q&A session as Markdown

**Query Pipeline:**
```
User query string
      │
      ▼
Embed query (same model as index)
      │
      ▼
pgvector similarity search → top-K chunks
      │
      ▼
[Optional] Reranker (cross-encoder) → reordered chunks
      │
      ▼
Prompt assembly:
  System: "Answer using only the provided context. Cite sources."
  Context: top-K chunks with [SOURCE_N] labels
  History: last 5 turns
  User: original query
      │
      ▼
LLM API call (streaming)
      │
      ▼
Parse response → extract citations → map [SOURCE_N] to chunk metadata
      │
      ▼
Stream to client with inline citation markers
```

**Acceptance Criteria:**
- Query response begins streaming within 1.5 seconds of submission
- Citations correctly link to the source document and highlight the relevant passage
- "Search" mode returns raw chunks sorted by similarity score with metadata visible
- Query returns empty-state guidance if no results above similarity threshold

---

### 3.6 API Playground & Developer Interface

**Priority:** P0 — This is what makes it feel like a real developer tool

**Requirements:**
- In-browser API playground (similar to Postman or Swagger UI but custom-branded)
- Panels: Endpoint selector | Request builder | Response viewer | Code snippet generator
- Auto-generates code snippets in: cURL, Python, TypeScript, Node.js
- Test any index query directly in the browser with your workspace API key
- Request history: last 50 API calls with request/response stored per session
- Latency breakdown shown per request: embed time, search time, rerank time, LLM time, total
- API key management panel: create, name, revoke, and set expiry for API keys

**REST API for External Use:**
```
POST /api/v1/indexes/:indexId/query
Headers: Authorization: Bearer {api_key}
Body: {
  query: "How do I deploy to production?",
  top_k: 5,
  threshold: 0.7,
  rerank: true,
  mode: "answer" | "search",
  stream: true
}

Response (stream=false):
{
  answer: "To deploy to production, you first...",
  sources: [
    { chunk_id, document_title, source_url, excerpt, similarity_score }
  ],
  latency: { embed_ms, search_ms, rerank_ms, llm_ms, total_ms },
  tokens_used: { query: 12, context: 847, answer: 203 }
}
```

**Acceptance Criteria:**
- Code snippet is immediately copy-pasteable and works without modification
- Latency breakdown visible for every request in the playground
- API key revocation takes effect within 30 seconds

---

### 3.7 Query Analytics Dashboard

**Priority:** P1

**Requirements:**
- Query volume: total queries per day/week/month — line chart
- Top queries: most frequent queries, with click-through to see answers returned
- Zero-result queries: queries that returned no chunks above threshold — high-value signal for content gaps
- Latency percentiles: p50, p90, p99 per day — helps identify embedding model performance
- Source attribution heatmap: which documents are cited most often
- User satisfaction (optional): thumbs up/down on answers — logged and aggregated
- Alerts: notify if zero-result rate exceeds 20% over last 24 hours

**Acceptance Criteria:**
- Analytics data lags by at most 5 minutes (near-real-time aggregation)
- Zero-result query list is exportable as CSV
- Source heatmap correctly identifies top 10 most-cited documents

---

### 3.8 Embedding Model Configuration

**Priority:** P1

**Supported Models:**

| Provider | Model | Dimensions | Best For |
|---|---|---|---|
| OpenAI | text-embedding-3-small | 1536 | General purpose, fast |
| OpenAI | text-embedding-3-large | 3072 | High accuracy |
| Cohere | embed-english-v3.0 | 1024 | Enterprise, multilingual |
| Local (Ollama) | nomic-embed-text | 768 | Privacy, no API cost |

**Requirements:**
- Embedding model selected at index creation time (cannot change after first ingestion)
- If model changes needed: create a new index version (triggers full re-ingestion)
- Workspace-level API key for each provider stored in credential vault
- Model benchmark panel: run a test query set against multiple models and compare NDCG@5

---

## 4. Architecture

### 4.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│               Next.js Frontend — Vektor UI                       │
│   Index Manager | Data Sources | Query Chat | Analytics | API Playground │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                Stratos API Gateway (shared)                       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│              Vektor Core API (Node.js + TypeScript)               │
│  Indexes | DataSources | Query | Analytics | APIKeys              │
└────┬─────────────┬──────────────┬──────────────────────┬─────────┘
     │             │              │                      │
PostgreSQL       Redis         BullMQ              Python Ingestion
(metadata,     (cache,        (ingestion           Service (FastAPI)
 analytics,     sessions,      job queue)           ├── Connector adapters
 query logs)    pub/sub)                            ├── Chunking engine
                                                    ├── Embedding client
                                                    └── pgvector upsert
                                                          │
                                                    pgvector extension
                                                    (vector store,
                                                     HNSW index)
```

### 4.2 Vector Storage Strategy

**Development (slow PC friendly):**
- pgvector extension on PostgreSQL — single process, no extra container
- HNSW index for approximate nearest-neighbour search
- Schema-per-workspace for namespace isolation

**Production upgrade path:**
- Migrate to Qdrant (standalone container) for better performance at scale
- API abstraction layer means zero application code changes required

**pgvector Schema:**
```sql
-- One schema per workspace for isolation
CREATE SCHEMA workspace_{workspace_id};

CREATE TABLE workspace_{workspace_id}.chunks (
  id              UUID PRIMARY KEY,
  index_id        UUID NOT NULL,
  document_id     UUID NOT NULL,
  chunk_index     INTEGER,
  content         TEXT,
  embedding       vector(1536),    -- dimension matches model
  metadata        JSONB,
  created_at      TIMESTAMP
);

CREATE INDEX ON workspace_{workspace_id}.chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 5. Tech Stack Summary

| Layer | Technology | Note |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, CodeMirror | API playground editor |
| API | Node.js 20, Express, TypeScript, Zod | Core service |
| Ingestion Service | Python 3.11, FastAPI, LangChain (chunking only) | Separate process |
| Vector Store | pgvector (dev), Qdrant (prod path) | Abstracted behind interface |
| Embedding Models | OpenAI SDK, Cohere SDK, Ollama client | Multi-provider router |
| Reranking | Cross-encoder via sentence-transformers (Python) | Optional, quality boost |
| Database | PostgreSQL 15 + pgvector | Primary store |
| Queue | Redis 7 + BullMQ | Ingestion jobs |
| Analytics | TimescaleDB extension (or simple Postgres time series) | Query event storage |
| Testing | Jest, pytest, Playwright | |
| CI/CD | GitHub Actions | |
| Local Dev | Docker Compose, Vite, Turborepo | |

---

## 6. Build Speed Optimizations (Slow PC)

- **pgvector instead of Qdrant** for local dev — no extra Docker container
- **Ollama for local embeddings** — no API calls during dev (`EMBEDDING_PROVIDER=local`)
- **Mock connectors** — GitHub/Confluence connectors return fixture data in dev mode
- **Small test corpus** — `seed:dev` script loads 20 small markdown files, not real crawls
- **Vite** for frontend — instant HMR
- **Turborepo remote cache** — skip rebuilding packages that haven't changed

---

## 7. Milestones & Timeline

| Month | Focus | Deliverables |
|---|---|---|
| Month 1 | Index & Ingestion | Index CRUD, file upload connector, chunking engine, pgvector storage, ingestion progress SSE |
| Month 2 | Query & API | Query pipeline (embed→search→rerank→LLM), streaming chat UI, citations, API + playground |
| Month 3 | Connectors & Analytics | GitHub + URL connectors, query analytics dashboard, embedding model config, model benchmark |

---

## 8. What This Proves to FAANG Interviewers

- **AI Infrastructure Depth:** Embeddings, vector search, chunking strategies, reranking — the full RAG stack
- **Data Pipeline Engineering:** Fault-tolerant multi-stage ingestion with real-time observability
- **Multi-Tenant Platform Design:** Namespace isolation at the vector store level, not just application filtering
- **Developer Tooling Instincts:** API playground, code snippet generation, latency breakdown — the things great dev tools have
- **Analytical Thinking:** Zero-result query tracking and source attribution heatmaps show product + data maturity

---

*End of PRD-02: Stratos Vektor*
