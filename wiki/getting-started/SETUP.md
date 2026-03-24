# Getting Started - Stratos Platform Setup

## Prerequisites

Before you begin, ensure you have installed:

- **Node.js** 18+ (for backend APIs and frontend)
- **Python** 3.10+ (for ML service in Aurum)
- **Docker** and **Docker Compose** (for infrastructure)
- **PostgreSQL** client tools (`psql`)
- **Git** (for version control)

## Initial Setup

### Step 1: Clone and Navigate to Repository

```bash
cd d:\Kushal\projects\stratos
```

### Step 2: Start Infrastructure

Create a `docker-compose.yml` in the root of the stratos directory:

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start services:
```bash
docker-compose up -d
docker logs postgres --follow  # Wait for "database system is ready"
```

### Step 3: Initialize Databases

```bash
# Create databases
psql -h localhost -U postgres -c "CREATE DATABASE meridian;"
psql -h localhost -U postgres -c "CREATE DATABASE vektor;"
psql -h localhost -U postgres -c "CREATE DATABASE aurum;"
```

### Step 4: Set Up Environment Variables

Create `.env` files in each project root:

**meridian/.env:**
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meridian
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=debug
OPENAI_API_KEY=your_key_here
```

**vektor/.env:**
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vektor
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=debug
OPENAI_API_KEY=your_key_here
```

**aurum/.env:**
```env
NODE_ENV=development
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aurum
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=debug
```

### Step 5: Install Dependencies and Start Services

#### Terminal 1 - Meridian Backend
```bash
cd meridian/backend
npm install
npm run dev
# Server will start on http://localhost:3000
```

#### Terminal 2 - Meridian Frontend
```bash
cd meridian/frontend
npm install
npm run dev
# Frontend will start on http://localhost:3000 (Next.js dev server)
```

#### Terminal 3 - Vektor Backend
```bash
cd vektor/backend
npm install
npm run dev
# Server will start on http://localhost:3001
```

#### Terminal 4 - Vektor Frontend
```bash
cd vektor/frontend
npm install
npm run dev
# Frontend will start on http://localhost:3001 (Next.js)
```

#### Terminal 5 - Aurum Backend
```bash
cd aurum/backend
npm install
npm run dev
# Server will start on http://localhost:3002
```

#### Terminal 6 - Aurum Frontend
```bash
cd aurum/frontend
npm install
npm run dev
# Frontend will start on http://localhost:3002 (Next.js)
```

## Verifying Setup

### Check Backend Services

```bash
# Meridian
curl http://localhost:3000/health
# Response: {"status":"healthy","service":"Meridian API","version":"1.0.0"}

# Vektor
curl http://localhost:3001/health
# Response: {"status":"healthy","service":"Vektor API","version":"1.0.0"}

# Aurum
curl http://localhost:3002/health
# Response: {"status":"healthy","service":"Aurum API","version":"1.0.0"}
```

### Access Frontends

- **Meridian**: http://localhost:3000/editor
- **Vektor**: http://localhost:3001/query
- **Aurum**: http://localhost:3002/dashboard

## Database Schema Initialization

For production, run migrations to create tables. For local development, tables will be created on first API call if using ORM.

To manually create core tables:

```bash
# Meridian - Workflow and Execution Tables
psql -h localhost -U postgres -d meridian << 'EOF'
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  nodes JSONB,
  edges JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflows_workspace ON workflows(workspace_id);
EOF

# Vektor - Index and Chunk Tables
psql -h localhost -U postgres -d vektor << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE indexes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  embedding_model VARCHAR(100),
  status VARCHAR(20) DEFAULT 'EMPTY',
  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_indexes_workspace ON indexes(workspace_id);
EOF

# Aurum - Account and Prediction Tables
psql -h localhost -U postgres -d aurum << 'EOF'
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  arr NUMERIC(12,2) DEFAULT 0,
  health_score NUMERIC(5,2) DEFAULT 75,
  churn_probability NUMERIC(5,4) DEFAULT 0.15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accounts_org ON accounts(org_id);
EOF
```

## Testing API Endpoints

### Meridian - Create and List Workflows

```bash
# Create workflow
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_demo_123" \
  -d '{
    "name": "Data Processing Pipeline",
    "description": "Test workflow"
  }'

# List workflows
curl http://localhost:3000/api/workflows \
  -H "x-workspace-id: ws_demo_123"
```

### Vektor - Create Index

```bash
# Create index
curl -X POST http://localhost:3001/api/indexes \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ws_demo_123" \
  -d '{
    "name": "Documentation Index",
    "embedding_model": "text-embedding-3-small",
    "chunk_size": 1024
  }'
```

### Aurum - Create Account

```bash
# Create account
curl -X POST http://localhost:3002/api/accounts \
  -H "Content-Type: application/json" \
  -H "x-org-id: org_demo_123" \
  -d '{
    "name": "Acme Corporation",
    "arr": 500000
  }'

# Get dashboard
curl http://localhost:3002/api/dashboard/org_demo_123
```

## Troubleshooting

### PostgreSQL Connection Error

```
Error: ECONNREFUSED
```

**Solution**: Ensure PostgreSQL container is running
```bash
docker-compose logs postgres
docker-compose ps
```

### Redis Connection Error

```
Error: ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Ensure Redis container is running
```bash
docker-compose ps
docker-compose restart redis
```

### Port Already in Use

If port 3000, 3001, or 3002 is already in use, either:
- Kill the process using that port
- Change PORT in `.env` files
- Run service on different port: `npm run dev -- --port 3010`

### Module Not Found

```
Error: Cannot find module 'express'
```

**Solution**: Install dependencies
```bash
npm install
```

## Development Tips

1. **Hot Reload**: All services use `ts-node` with file watchers for hot reload during development
2. **Logging**: Set `LOG_LEVEL=debug` in `.env` for verbose logging
3. **Database Queries**: Use `psql` directly to inspect data:
   ```bash
   psql -h localhost -U postgres -d meridian
   \dt  # List tables
   SELECT * FROM workflows;
   ```
4. **Redis CLI**: Inspect Redis:
   ```bash
   docker exec -it $(docker-compose ps -q redis) redis-cli
   KEYS *
   GET key_name
   ```

## Next Steps

1. Read [System Architecture](../shared-architecture/SYSTEM_ARCHITECTURE.md) to understand how services interact
2. Review [Multi-Tenancy Model](../shared-architecture/MULTI_TENANCY.md) for org/workspace concepts
3. Check product-specific guides:
   - [Meridian Development](./meridian/DEVELOPMENT.md)
   - [Vektor Development](./vektor/DEVELOPMENT.md)
   - [Aurum Development](./aurum/DEVELOPMENT.md)

---

**Last Updated**: March 24, 2026
