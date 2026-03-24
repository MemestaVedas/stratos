# Vektor - Comprehensive Development Guide

## Overview

Vektor is Stratos' semantic search and knowledge intelligence platform. It enables enterprises to ingest diverse data sources (documents, databases, APIs, code repositories), build vector indexes with configurable chunking strategies, and query them using natural language with RAG (Retrieval-Augmented Generation).

## Architecture

```
┌──────────────────────────────────┐
│  Frontend (Next.js + React)      │
│  - Index Manager                 │
│  - Data Source Management        │
│  - Chat Query Interface          │
│  - Analytics Dashboard           │
│  - API Playground                │
└────────────┬──────────────────────┘
             │
┌────────────▼──────────────────────┐
│  API Gateway & Auth              │
└────────────┬──────────────────────┘
             │
┌────────────▼──────────────────────────────────┐
│  Vektor API (Node.js + Express)                │
│  - Index CRUD                                 │
│  - Data Source Management                    │
│  - Semantic Search / Query                   │
│  - Analytics                                 │
│  - API Key Management                        │
└──┬────────┬──────────┬──────────┬─────────┬──┘
   │        │          │          │         │
   ▼        ▼          ▼          ▼         ▼
PostgreSQL pgvector  Redis      BullMQ  FastAPI
(metadata)(vectors)(cache)  (pipeline)  (Python)
```

## Project Structure

```
vektor/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config/
│   │   │   ├── database.ts          # pgvector setup
│   │   │   └── redis.ts
│   │   ├── models/
│   │   │   ├── Index.ts
│   │   │   ├── DataSource.ts
│   │   │   └── Chunk.ts
│   │   ├── routes/
│   │   │   ├── indexes.ts           # Index CRUD
│   │   │   ├── datasources.ts       # Connector management
│   │   │   ├── query.ts             # Search endpoint
│   │   │   └── analytics.ts         # Dashboard metrics
│   │   ├── services/
│   │   │   ├── ingestion/           # Chunking, embedding
│   │   │   ├── query/               # Search + RAG pipeline
│   │   │   └── vectorstore.ts       # pgvector wrapper
│   │   ├── connectors/              # Data source adapters
│   │   │   ├── file.ts
│   │   │   ├── github.ts
│   │   │   ├── confluence.ts
│   │   │   ├── notion.ts
│   │   │   ├── postgres.ts
│   │   │   └── rest-api.ts
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── embedding.ts
│   ├── migrations/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── index-manager/
│   │   │   ├── datasources/
│   │   │   ├── query/
│   │   │   │   ├── QueryInterface.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   └── SourceCitation.tsx
│   │   │   ├── analytics/
│   │   │   └── api-playground/
│   │   └── pages/
│   │       ├── indexes.tsx
│   │       ├── query.tsx
│   │       ├── analytics.tsx
│   │       └── playground.tsx
│   └── package.json
├── python-service/
│   ├── src/
│   │   ├── ingestion/
│   │   │   ├── chunkers.py          # Fixed-size, sentence, semantic
│   │   │   ├── extractors.py       # PDF, HTML, plaintext
│   │   │   └── cleaner.py           # Normalization
│   │   ├── embedding/
│   │   │   └── models.py            # OpenAI, Cohere, Ollama
│   │   ├── reranking/
│   │   │   └── cross_encoder.py
│   │   └── pipeline.py              # Orchestration
│   ├── requirements.txt
│   └── main.py                      # FastAPI app
│── docs/
│   └── ARCHITECTURE.md
└── README.md
```

## Core Concepts

### Index

An **Index** is the central resource in Vektor - a named, versioned, queryable vector namespace.

```typescript
interface Index {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  embedding_model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'embed-english-v3.0' | 'nomic-embed-text';
  chunk_size: number;
  chunk_overlap: number;
  distance_metric: 'cosine' | 'euclidean' | 'dot_product';
  status: 'EMPTY' | 'BUILDING' | 'READY' | 'DEGRADED';
  total_chunks: number;
  total_tokens: number;
  last_updated: Date;
  created_at: Date;
}
```

### Data Sources

Multiple data source types feed into an index:

| Type | Auth | Sync Strategy |
|------|------|---------------|
| File Upload | N/A | Manual |
| Website | N/A | Crawl |
| GitHub | OAuth2/PAT | Full + incremental on push |
| Confluence | API Token | Full + scheduled |
| Notion | OAuth2 | Full + scheduled |
| PostgreSQL | Connection string | SQL query |
| REST API | API Key/Bearer | Scheduled pull |
| Plain Text | N/A | Direct paste |

### Ingestion Pipeline

The pipeline processes raw data into indexed vectors:

```
Data Source
    │
    ▼
┌─────────────┐
│  Extract    │  (PDF text, HTML parse, code read, DB query)
└──────┬──────┘
       ▼
┌─────────────────────┐
│  Clean & Normalize  │  (strip HTML, whitespace, deduplicate)
└──────┬──────────────┘
       ▼
┌──────────────────┐
│  Chunk Content   │  (fixed-size, sentence, paragraph, or semantic)
└──────┬───────────┘
       ▼
┌─────────────────┐
│  Embed Chunks   │  (OpenAI, Cohere, Ollama)
└──────┬──────────┘
       ▼
┌──────────────────┐
│  Store Vectors   │  (pgvector with HNSW index)
└──────┬───────────┘
       ▼
┌──────────────────┐
│  Index Update    │  (refresh HNSW)
└──────┬───────────┘
       ▼
   Ready
```

### Query Pipeline

When a user queries, the RAG pipeline synthesizes an answer from relevant documents:

```
User Query
    │
    ▼
┌─────────────────┐
│  Embed Query    │  (same model as index)
└──────┬──────────┘
       ▼
┌─────────────────────────┐
│  pgvector Similarity    │  (cosine/euclidean/dot product)
└──────┬──────────────────┘
       ▼
┌──────────────────┐
│  Get Top-K Chunks   │  (1-20, configurable)
└──────┬───────────┘
       ▼
┌──────────────────────┐
│  [Optional] Reranking   │  (cross-encoder rerank)
└──────┬───────────────┘
       ▼
┌──────────────────────┐
│  Format Context      │  (combine chunks + metadata)
└──────┬───────────────┘
       ▼
┌──────────────────────┐
│  LLM Synthesis       │  (stream answer with citations)
└──────┬───────────────┘
       ▼
Answer with Sources
```

## Development Workflow

### 1. Create an Index

```bash
# POST /api/indexes
curl -X POST http://localhost:3001/api/indexes \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_123" \
  -d '{
    "name": "Company Documentation",
    "description": "Internal docs, runbooks, code guides",
    "embedding_model": "text-embedding-3-small",
    "chunk_size": 1024,
    "chunk_overlap": 20,
    "distance_metric": "cosine"
  }'

# Response:
# {
#   "id": "idx_abc123",
#   "status": "EMPTY",
#   "total_chunks": 0,
#   "created_at": "2026-03-24T10:30:00Z"
# }
```

### 2. Add Data Sources

```bash
# POST /api/datasources
curl -X POST http://localhost:3001/api/datasources \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_123" \
  -d '{
    "index_id": "idx_abc123",
    "name": "GitHub Docs",
    "type": "github",
    "config": {
      "owner": "company",
      "repo": "docs",
      "branch": "main",
      "include_patterns": ["*.md", "*.txt"]
    }
  }'
```

### 3. Trigger Ingestion

```bash
# POST /api/datasources/:dsId/sync
curl -X POST http://localhost:3001/api/datasources/ds_xyz/sync \
  -H "x-workspace-id: ws_123"

# Response:
# {
#   "sync_job_id": "sync_12345",
#   "status": "STARTED",
#   "index_id": "idx_abc123"
# }

# Monitor progress via SSE
curl http://localhost:3001/api/datasources/ds_xyz/sync/sync_12345/stream \
  -H "x-workspace-id: ws_123"
```

### 4. Query the Index

**Mode 1: RAG Answer with Citations**
```bash
# POST /api/query/:indexId
curl -X POST http://localhost:3001/api/query/idx_abc123 \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_123" \
  -d '{
    "query": "How do I deploy to production?",
    "top_k": 5,
    "threshold": 0.7,
    "rerank": true,
    "stream": true
  }'

# Streamed Response:
# data: {"type":"answer","chunk":"To deploy to production, first..."}
# data: {"type":"sources","citations":[{"doc":"deploy-guide.pdf","chunk":0}]}
# data: {"type":"metadata","tokens_used":{"embed":15,"search":0,"llm":250}}
```

**Mode 2: Search Only (Raw Chunks)**
```bash
# Same endpoint with search_mode=true
curl -X POST http://localhost:3001/api/query/idx_abc123 \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_123" \
  -d '{
    "query": "deployment process",
    "top_k": 10,
    "search_mode": true
  }'

# Response:
# {
#   "results": [
#     {
#       "chunk_id": "chunk_1",
#       "content": "Deployment happens in three stages...",
#       "similarity_score": 0.92,
#       "source": "deployment-guide.pdf",
#       "metadata": {"page_number": 3}
#     },
#     ...
#   ]
# }
```

### 5. Monitor Analytics

```bash
# GET /api/analytics/:indexId
curl http://localhost:3001/api/analytics/idx_abc123 \
  -H "x-workspace-id: ws_123"

# Response:
# {
#   "query_volume": {
#     "today": 1523,
#     "this_week": 8945,
#     "this_month": 32100
#   },
#   "zero_result_queries": {
#     "count": 123,
#     "percentage": 3.8,
#     "top_zero_queries": ["...", "..."]
#   },
#   "latency_percentiles": {
#     "p50": 450,
#     "p90": 1200,
#     "p99": 2500
#   },
#   "top_queries": [...],
#   "source_heatmap": {...}
# }
```

## Key Implementation Details

### Chunking Strategies

**Fixed-Size (Default)**
```python
# Split into 1024-char chunks with 20-char overlap
chunks = []
start = 0
while start < len(text):
    end = start + chunk_size
    chunk = text[start:end]
    chunks.append(chunk)
    start = end - chunk_overlap
```

**Sentence-Boundary**
```python
# Split on sentences, then combine to reach chunk_size
sentences = split_by_sentence(text)
chunk = ""
for sentence in sentences:
    if len(chunk) + len(sentence) > chunk_size:
        chunks.append(chunk)
        chunk = sentence
    else:
        chunk += " " + sentence
```

**Semantic (LLM-Assisted)**
```python
# Use LLM to find optimal split points
response = llm.generate(f"""
Break this text into semantically meaningful chunks.
Rules:
- Each chunk should be self-contained
- Approximately {chunk_size} tokens
Text: {text}
""")
# Parse response to extract chunk boundaries
```

### pgvector Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chunks table with vector column
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  index_id UUID NOT NULL,
  document_id UUID,
  content TEXT NOT NULL,
  embedding vector(1536),  -- Match embedding dimension
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (index_id) REFERENCES indexes(id)
);

-- Create HNSW index for fast ANN
CREATE INDEX ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- For dot product distance
CREATE INDEX ON chunks
  USING hnsw (embedding vector_ip_ops);
```

### Embedding Service

```typescript
// src/services/embedding.ts

async function embedBatch(texts: string[], model: string): Promise<number[][]> {
  const client = getEmbeddingClient(model);
  
  // Batch up to 100 texts per API call (OpenAI limit)
  const batches = chunk(texts, 100);
  const embeddings: number[][] = [];
  
  for (const batch of batches) {
    const response = await client.embeddings.create({
      model: model,
      input: batch
    });
    
    embeddings.push(...response.data.map(d => d.embedding));
    
    // Track tokens
    trackTokenUsage(model, {
      input_tokens: response.usage.prompt_tokens
    });
  }
  
  return embeddings;
}
```

### Query with Reranking

```typescript
// src/services/query.ts

async function query(
  indexId: string,
  queryText: string,
  topK: number = 5,
  rerank: boolean = true
): Promise<QueryResult> {
  // 1. Embed query
  const queryEmbedding = await embedText(queryText, index.embedding_model);
  
  // 2. Vector search
  const chunks = await vectorStore.search({
    embedding: queryEmbedding,
    index_id: indexId,
    limit: topK * 2  // Get more for reranking
  });
  
  // 3. Rerank if requested
  if (rerank && chunks.length > topK) {
    const reranked = await reranker.rerank(
      queryText,
      chunks.map(c => c.content),
      topK
    );
    chunks = reranked;
  }
  
  // 4. Build context for LLM
  const context = chunks.map(c => c.content).join('\n---\n');
  
  // 5. LLM synthesis
  const answer = await llm.generate({
    system: "Answer using only provided context. Cite sources.",
    user: queryText,
    context: context
  });
  
  // 6. Parse citations and map to chunks
  const citations = parseCitations(answer, chunks);
  
  return {
    answer: answer,
    sources: citations,
    latency_ms: { embed: t1, search: t2, rerank: t3, llm: t4 }
  };
}
```

### Real-Time Ingestion Dashboard

```typescript
// src/routes/datasources.ts

router.get('/:dsId/sync/:syncId/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  const channel = `ingestion:${syncId}:progress`;
  subscriber.subscribe(channel);
  
  subscriber.on('message', (ch, message) => {
    const event = JSON.parse(message);
    // Event format:
    // {
    //   stage: 'extract' | 'clean' | 'chunk' | 'embed' | 'store',
    //   progress: 0.35,
    //   message: 'Processed 150/500 documents',
    //   estimated_remaining_minutes: 8
    // }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  
  req.on('close', () => subscriber.unsubscribe(channel));
});
```

## Database Schema

```sql
-- Indexes
CREATE TABLE indexes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100),
  chunk_size INT DEFAULT 1024,
  chunk_overlap INT DEFAULT 20,
  distance_metric VARCHAR(50) DEFAULT 'cosine',
  status VARCHAR(50) DEFAULT 'EMPTY',
  total_chunks INT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Data Sources
CREATE TABLE data_sources (
  id UUID PRIMARY KEY,
  index_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),  -- file, github, confluence, etc.
  config JSONB,
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (index_id) REFERENCES indexes(id)
);

-- Sync Jobs
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  data_source_id UUID NOT NULL,
  index_id UUID NOT NULL,
  status VARCHAR(50),  -- QUEUED, RUNNING, COMPLETED, FAILED
  documents_processed INT DEFAULT 0,
  chunks_generated INT DEFAULT 0,
  tokens_consumed BIGINT DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id)
);

-- Chunks with vectors
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  index_id UUID NOT NULL,
  document_id UUID,  -- Reference to source document
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,  -- source, page, section, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (index_id) REFERENCES indexes(id)
);

-- Query Analytics
CREATE TABLE query_logs (
  id BIGSERIAL PRIMARY KEY,
  index_id UUID NOT NULL,
  query TEXT NOT NULL,
  result_count INT,
  latency_ms INT,
  tokens_used INT,
  user_feedback INT,  -- thumbs up/down
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (index_id) REFERENCES indexes(id)
);
```

## Testing

### Unit Tests

```bash
npm test
```

Tests cover:
- Chunking strategies (fixed-size, sentence, semantic)
- Embedding API integration
- Vector similarity search
- Reranking logic
- Citation extraction

### Integration Tests

```bash
npm run test:integration
```

Test complete flows:
- Create index → Add data source → Ingest → Query
- Verify result quality
- Check analytics accuracy

### Load Tests

```bash
npm run test:load
```

- Concurrent query load
- Ingestion throughput
- Vector search performance

## Performance Optimization

1. **HNSW Index**: Fast approximate nearest neighbor search
2. **Batch Embedding**: Embed 100 texts per API call
3. **Redis Caching**: Cache frequent queries and embeddings
4. **Connection Pooling**: Database connections pooled
5. **Lazy Chunk Loading**: Stream chunks instead of loading all

## Connector Implementation Pattern

```typescript
// src/connectors/base.ts

export abstract class BaseConnector {
  abstract async authenticate(): Promise<void>;
  abstract async listDocuments(): Promise<Document[]>;
  abstract async getDocument(id: string): Promise<DocumentContent>;
  abstract async supportsIncremental(): boolean;
}

// src/connectors/github.ts

export class GitHubConnector extends BaseConnector {
  async authenticate() {
    // Validate token
  }
  
  async listDocuments() {
    // Call GitHub API to list files
    // Filter by include_patterns
  }
  
  async getDocument(filePath: string) {
    // Fetch raw content for file
  }
  
  async supportsIncremental() {
    return true;  // Supports incremental updates via webhooks
  }
}
```

## Security

1. **API Keys**: Workspace-scoped, revocable
2. **Encryption**: Secrets stored encrypted
3. **Isolation**: Each org can only query own indexes
4. **Rate Limiting**: Per-workspace query quotas

## Common Issues

| Issue | Solution |
|-------|----------|
| Embeddings dimension mismatch | Ensure all chunks use same model |
| Zero result queries | Lower similarity threshold or reindex |
| Slow ingestion | Use batch embedding, increase chunk size |
| Memory issues | Stream large files instead of loading all |

---

**Last Updated**: March 24, 2026
