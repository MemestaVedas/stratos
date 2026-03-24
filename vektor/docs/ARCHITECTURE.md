# Vektor Project Structure

```
vektor/
├── backend/                    # Node.js API Server
│   ├── src/
│   │   ├── index.ts           # Main entry point
│   │   ├── config/
│   │   │   ├── database.ts    # PostgreSQL + pgvector setup
│   │   │   └── redis.ts       # Redis setup
│   │   ├── models/
│   │   │   └── Index.ts       # Index data model
│   │   ├── routes/
│   │   │   ├── indexes.ts     # Index management endpoints
│   │   │   ├── datasources.ts # Data source connectors
│   │   │   ├── query.ts       # Semantic search endpoints
│   │   │   └── analytics.ts   # Analytics endpoints
│   │   ├── services/
│   │   │   └── ingestion/     # Chunking, embedding pipeline
│   │   ├── connectors/        # Data source adapters
│   │   └── utils/
│   │       └── logger.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Next.js React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── query/
│   │   │       └── QueryInterface.tsx
│   │   └── pages/
│   │       └── query.tsx
│   ├── package.json
│   └── tsconfig.json
├── python-service/             # FastAPI Ingestion Service
│   └── src/
├── docs/                       # Documentation
```

## Key Features Implemented

1. **Index Management**
   - Create, retrieve, list, and delete vector indexes
   - Configurable embedding models (OpenAI, Cohere, Ollama)
   - Chunk size, overlap, and distance metric configuration
   - Status tracking (EMPTY, BUILDING, READY, DEGRADED)

2. **Data Source Connectors**
   - Support for multiple data source types
   - File upload, URL crawling, GitHub, Confluence
   - Automated sync job tracking
   - Error handling and retry logic

3. **Ingestion Pipeline**
   - Real-time progress tracking
   - Multi-stage pipeline: Extract → Clean → Chunk → Embed → Store
   - Token consumption tracking
   - Deduplication support

4. **Query Interface**
   - Natural language semantic search
   - RAG pipeline with LLM synthesis
   - Source citations and references
   - Conversation memory support
   - Search mode (raw chunks) vs Answer mode (LLM synthesis)

5. **Analytics**
   - Query volume tracking
   - Zero-result detection
   - Latency percentiles (p50, p90, p99)
   - Top queries and source heatmap
   - Document citation analysis

## Performance Considerations

- pgvector with HNSW indexing for fast ANN search
- Redis caching for frequent queries
- Batch embedding for efficiency
- Async ingestion pipeline with BullMQ
- Real-time progress tracking via SSE

## Next Steps

- Implement chunking strategies (fixed-size, sentence, semantic)
- Build embedding model abstraction layer
- Add reranking with cross-encoder models
- Implement multi-language support
- Add query rewriting for better retrieval
