# Meridian Project Structure

```
meridian/
├── backend/                    # Node.js API Server
│   ├── src/
│   │   ├── index.ts           # Main entry point
│   │   ├── config/
│   │   │   ├── database.ts    # PostgreSQL connection
│   │   │   └── redis.ts       # Redis setup
│   │   ├── models/
│   │   │   └── Workflow.ts    # Workflow data model
│   │   ├── routes/
│   │   │   ├── workflows.ts   # Workflow API endpoints
│   │   │   ├── executions.ts  # Execution API endpoints
│   │   │   ├── triggers.ts    # Trigger endpoints
│   │   │   └── credentials.ts # Credentials management
│   │   ├── services/
│   │   │   └── execution/     # Execution engine
│   │   └── utils/
│   │       └── logger.ts      # Logging utility
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Next.js React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── editor/
│   │   │       └── DAGEditor.tsx
│   │   └── pages/
│   │       └── editor.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
├── workers/                    # BullMQ Workers
│   └── src/
└── docs/                       # Documentation
```

## Key Features Implemented

1. **Backend API Structure**
   - Express.js server with TypeScript
   - PostgreSQL database integration
   - Redis pub/sub for real-time updates
   - Workflow CRUD operations
   - Execution management endpoints
   - Trigger system (webhook, cron, manual, event)
   - Credentials vault API

2. **Frontend Editor**
   - React-based DAG editor interface
   - Node palette with 10 node types
   - Canvas for workflow design
   - Configuration panel
   - Save and Run functionality

3. **API Endpoints**
   - `GET/POST /api/workflows` - Workflow management
   - `GET/POST /api/executions` - Execution management
   - `POST /api/triggers/webhook/:workflowId` - Webhook triggers
   - `GET/POST /api/credentials` - Credential management

4. **Core Services**
   - Workflow versioning system
   - Multi-tenant isolation via workspace_id
   - Execution engine queue (BullMQ ready)
   - Audit logging with Winston

## Database Models

Workflows are stored with the following schema:
- `workflows` table: Core workflow definition
- `workflow_versions` table: Immutable version history
- `workflow_deployments` table: Deployment tracking
- `executions` table: Execution records with status tracking

## Next Steps

- Implement React Flow canvas component
- Build execution engine with DAG topological sorting
- Add LLM node with multi-model support
- Implement WebSocket for real-time execution status
- Add workflow validation and cycle detection
