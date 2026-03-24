# Vektor - API Reference

Complete REST API documentation for the Vektor semantic search platform.

## Authentication

All API endpoints require a valid JWT token:

```bash
Authorization: Bearer {jwt_token}
```

## Indexes API

### List Indexes

```bash
GET /api/indexes?status=ready&limit=20

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "idx_123",
      "name": "Company Knowledge Base",
      "description": "Internal documentation and guides",
      "embedding_model": "text-embedding-3-small",
      "embedding_dimension": 1536,
      "status": "ready",
      "total_chunks": 45230,
      "created_at": "2024-03-24T10:30:00Z"
    }
  ],
  "pagination": { "total": 12 }
}
```

### Create Index

```bash
POST /api/indexes

Body:
{
  "name": "Product Knowledge Base",
  "description": "Product documentation and FAQs",
  "embedding_model": "text-embedding-3-small"
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "idx_456",
    "name": "Product Knowledge Base",
    "status": "empty",
    "created_at": "2024-03-24T12:00:00Z"
  }
}
```

### Get Index

```bash
GET /api/indexes/{index_id}

Response (200):
{
  "status": "success",
  "data": {
    "id": "idx_123",
    "name": "Company Knowledge Base",
    "status": "ready",
    "total_chunks": 45230,
    "storage_used_mb": 234,
    "last_ingestion_at": "2024-03-24T11:30:00Z"
  }
}
```

### Delete Index

```bash
DELETE /api/indexes/{index_id}

Response (204): No content
```

## Chunks API

### List Chunks

```bash
GET /api/indexes/{index_id}/chunks?source_type=github&limit=50

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "chunk_123",
      "content": "To set up the development environment...",
      "source_id": "repos/acme/backend",
      "source_type": "github",
      "chunk_number": 1,
      "metadata": {
        "file_path": "docs/SETUP.md",
        "repository": "acme/backend"
      },
      "created_at": "2024-03-24T10:30:00Z"
    }
  ],
  "pagination": { "total": 45230 }
}
```

### Delete Chunk

```bash
DELETE /api/chunks/{chunk_id}

Response (204): No content
```

## Query API

### Semantic Search with RAG

```bash
POST /api/indexes/{index_id}/query

Body:
{
  "query": "How do I set up the development environment?",
  "k": 5,
  "rerank": true,
  "include_metadata": true,
  "stream": false
}

Response (200):
{
  "status": "success",
  "data": {
    "query_id": "query_789",
    "query_text": "How do I set up the development environment?",
    "search_results": [
      {
        "chunk_id": "chunk_123",
        "content": "To set up the development environment...",
        "relevance_score": 0.92,
        "source_id": "repos/acme/backend",
        "source_type": "github",
        "metadata": { "file_path": "docs/SETUP.md" }
      },
      {
        "chunk_id": "chunk_124",
        "content": "Prerequisites for development...",
        "relevance_score": 0.87,
        "source_id": "repos/acme/backend"
      }
    ],
    "rag_response": {
      "text": "To set up the development environment, you need to...",
      "sources": ["chunk_123", "chunk_124"],
      "confidence": 0.89
    },
    "latencies": {
      "embedding_ms": 245,
      "search_ms": 123,
      "rerank_ms": 89,
      "llm_ms": 1234
    }
  }
}
```

### Streaming Query

```bash
POST /api/indexes/{index_id}/query

Body:
{
  "query": "What are the main features?",
  "stream": true
}

Response (200 - Server-Sent Events):
event: search_results
data: {"chunks": [...]}

event: rag_streaming
data: {"text": "The main features include..."}

event: rag_streaming
data: {"text": " real-time indexing,"}

event: rag_streaming
data: {"text": " multi-source connectors,"}

event: complete
data: {}
```

## Data Sources API

### List Data Sources

```bash
GET /api/indexes/{index_id}/datasources

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "ds_123",
      "name": "GitHub Repository",
      "source_type": "github",
      "ingestion_status": "running",
      "last_ingestion_at": "2024-03-24T11:30:00Z",
      "next_ingestion_at": "2024-03-24T12:30:00Z",
      "ingest_schedule": "0 * * * *"
    }
  ]
}
```

### Create Data Source

```bash
POST /api/indexes/{index_id}/datasources

Body:
{
  "name": "Company Confluence",
  "source_type": "confluence",
  "connector_config": {
    "workspace": "acme",
    "url": "https://acme.atlassian.net",
    "auth_type": "api_token",
    "api_token_encrypted": "..."
  },
  "ingest_schedule": "0 * * * *"
}

Response (201):
{
  "status": "success",
  "data": {
    "id": "ds_456",
    "name": "Company Confluence",
    "source_type": "confluence",
    "ingestion_status": "idle"
  }
}
```

### Trigger Ingestion

```bash
POST /api/datasources/{datasource_id}/ingest

Response (202):
{
  "status": "success",
  "data": {
    "job_id": "job_xyz",
    "status": "queued",
    "estimated_duration_seconds": 300
  }
}
```

### Get Ingestion Job Status

```bash
GET /api/jobs/{job_id}

Response (200):
{
  "status": "success",
  "data": {
    "job_id": "job_xyz",
    "status": "running",
    "progress": 0.45,
    "chunks_processed": 1234,
    "chunks_total": 2700,
    "started_at": "2024-03-24T11:30:00Z"
  }
}
```

## Analytics API

### Query Analytics

```bash
GET /api/indexes/{index_id}/analytics?start_date=2024-03-01&end_date=2024-03-24

Response (200):
{
  "status": "success",
  "data": {
    "total_queries": 5432,
    "avg_latency_ms": 456,
    "p50_latency_ms": 234,
    "p90_latency_ms": 1200,
    "p99_latency_ms": 2345,
    "zero_result_queries": 123,
    "zero_result_percentage": 2.26,
    "avg_result_quality": 0.87,
    "top_queries": [
      "how to set up",
      "installation guide",
      "troubleshooting"
    ],
    "source_distribution": {
      "github": 2345,
      "confluence": 1500,
      "slack": 1000,
      "web": 587
    },
    "unique_users": 234
  }
}
```

## Error Responses

### Invalid Query

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query must be at least 3 characters"
  }
}
```

### Index Not Ready

```json
{
  "status": "error",
  "error": {
    "code": "INDEX_NOT_READY",
    "message": "Index is still building. Current status: building",
    "retry_after_seconds": 30
  }
}
```

### Ingestion Failed

```json
{
  "status": "error",
  "error": {
    "code": "INGESTION_FAILED",
    "message": "Failed to connect to data source",
    "details": {
      "source_type": "github",
      "error": "Authentication failed"
    }
  }
}
```

---

**Last Updated**: March 24, 2026
