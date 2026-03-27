# Stratos Platform Wiki

Welcome to the Stratos Enterprise Intelligence Platform documentation. This wiki provides comprehensive guides for building, deploying, and maintaining the three core products: Meridian, Vektor, and Aurum.

## Platform Overview

Stratos is a B2B SaaS ecosystem consisting of three tightly integrated products:

### 1. **Stratos Meridian** - Workflow Orchestration Engine
- Visual DAG-based workflow builder
- Multi-tenant execution environment
- Real-time monitoring and observability
- Support for LLM calls, code execution, API integrations, human approvals
- Production-grade execution engine with error handling and retry logic

### 2. **Stratos Vektor** - Semantic Search & Knowledge Intelligence
- Enterprise-grade semantic search platform
- Multi-source data ingestion (files, databases, APIs, GitHub, Confluence)
- Real-time indexing with pgvector
- Natural language query interface with RAG
- Query analytics and source attribution

### 3. **Stratos Aurum** - Revenue Intelligence Platform
- ML-powered churn prediction with SHAP explainability
- Real-time health scoring engine
- Executive dashboards with ARR/NRR forecasting
- Event streaming and multi-tenant analytics
- Automated alert and playbook system

## Quick Links

- [What is Stratos? (Simple Explanation)](./WHAT_IS_STRATOS.md)
- [Getting Started Guide](./getting-started/SETUP.md)
- [System Architecture](./shared-architecture/SYSTEM_ARCHITECTURE.md)
- [Multi-Tenancy Model](./shared-architecture/MULTI_TENANCY.md)
- [API Standards](./shared-architecture/API_STANDARDS.md)
- [Database Schemas](./shared-architecture/DATABASE.md)

## Project Documentation

- **[Meridian Documentation](./meridian/README.md)**
  - [Feature Specifications](./meridian/FEATURES.md)
  - [API Reference](./meridian/API.md)
  - [Development Guide](./meridian/DEVELOPMENT.md)
  - [Execution Engine](./meridian/EXECUTION_ENGINE.md)

- **[Vektor Documentation](./vektor/README.md)**
  - [Feature Specifications](./vektor/FEATURES.md)
  - [API Reference](./vektor/API.md)
  - [Development Guide](./vektor/DEVELOPMENT.md)
  - [Ingestion Pipeline](./vektor/INGESTION_PIPELINE.md)

- **[Aurum Documentation](./aurum/README.md)**
  - [Feature Specifications](./aurum/FEATURES.md)
  - [API Reference](./aurum/API.md)
  - [Development Guide](./aurum/DEVELOPMENT.md)
  - [ML Model Pipeline](./aurum/ML_PIPELINE.md)

## Development Workflow

1. **Code Organization**: Each product is independently deployable with shared infrastructure dependencies
2. **Environment Setup**: Docker containers for PostgreSQL, Redis, and local development
3. **Commit Strategy**: Commit after each significant milestone (as per user preference)
4. **Testing**: Unit tests, integration tests, and end-to-end tests for each service
5. **Deployment**: Container-based deployment with Kubernetes orchestration for production

## Technology Stack

### Shared Infrastructure
- **API Gateway**: Express.js with TypeScript
- **Database**: PostgreSQL with pgvector extension
- **Caching/Messaging**: Redis with pub/sub
- **Job Queue**: BullMQ for async processing
- **Logging**: Winston for structured logging
- **Frontend**: Next.js 14 with React, Tailwind CSS

### Product-Specific
- **Meridian**: React Flow for DAG visualization
- **Vektor**: Semantic search with OpenAI/Cohere embeddings
- **Aurum**: XGBoost ML models with SHAP for explainability

## Environment Variables

All services require these base environment variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys
OPENAI_API_KEY=sk_...
STRIPE_API_KEY=sk_...

# Service Ports
MERIDIAN_PORT=3000
VEKTOR_PORT=3001
AURUM_PORT=3002
```

## Running All Services Locally

```bash
# Start infrastructure
docker-compose up -d

# In separate terminals, start each service:
cd meridian/backend && npm install && npm run dev    # Port 3000
cd vektor/backend && npm install && npm run dev      # Port 3001
cd aurum/backend && npm install && npm run dev       # Port 3002

# Start ML & Ingestion services (Python):
cd aurum/ml-service && pip install -r requirements.txt && python main.py         # Port 8001
cd vektor/ingestion-service && pip install -r requirements.txt && python main.py # Port 8002

# Start Meridian worker pool:
cd meridian/workers && npm install && npm run dev

# Start frontends in development mode:
cd meridian/frontend && npm install && npm run dev
cd vektor/frontend && npm install && npm run dev
cd aurum/frontend && npm install && npm run dev
```

## Security Considerations

- **Multi-Tenancy**: Strict org_id filtering on all queries
- **API Authentication**: JWT tokens with org/workspace scoping
- **Data Encryption**: Credentials encrypted at rest with AES-256-GCM
- **Rate Limiting**: Per-workspace quotas enforced at API gateway
- **RBAC**: Fine-grained role-based access control per service

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API Latency (p95) | < 500ms | Excludes external API calls |
| Workflow Execution | < 5s for 10-node DAG | Excluding LLM calls |
| Semantic Search | < 1.5s query-to-answer | Including embedding + LLM |
| Health Score Update | < 5s from event ingestion | Real-time analytics |
| Page Load | < 2s for dashboard | With pre-aggregated data |

## Support & Feedback

For questions or issues:
1. Check the specific product documentation
2. Review shared architecture docs for cross-product concerns
3. Refer to API standards for integration patterns
4. Check closed issues and PRs for solutions

---

**Version**: 1.0.0  
**Last Updated**: March 27, 2026  
**Status**: Implementation complete — all core features implemented
