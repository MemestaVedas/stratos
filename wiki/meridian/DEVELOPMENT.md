# Meridian - Comprehensive Development Guide

## Overview

Meridian is Stratos' workflow orchestration engine - a visual DAG builder that lets users design, deploy, and monitor complex multi-step AI agent pipelines. Think of it as Temporal + LangGraph + Zapier built from scratch.

## Architecture

```
┌─────────────────────────────────────┐
│  Frontend (React + React Flow)      │
│  - DAG Editor                       │
│  - Execution Dashboard              │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  API Gateway & Auth                 │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Meridian API (Node.js + Express)   │
│  - Workflow CRUD                    │
│  - Execution Management             │
│  - Trigger System                   │
│  - Credential Vault                 │
└──┬───────────┬────────┬──────────┬──┘
   │           │        │          │
   ▼           ▼        ▼          ▼
PostgreSQL   Redis   BullMQ     Workers
(Workflows) (Cache) (Queue)   (Execution)
```

## Project Structure

```
meridian/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── config/
│   │   │   ├── database.ts          # PostgreSQL setup
│   │   │   └── redis.ts             # Redis setup
│   │   ├── models/
│   │   │   └── Workflow.ts          # Workflow entity
│   │   ├── routes/
│   │   │   ├── workflows.ts         # CRUD operations
│   │   │   ├── executions.ts        # Run management
│   │   │   ├── triggers.ts          # Trigger endpoints
│   │   │   └── credentials.ts       # Secrets
│   │   ├── services/
│   │   │   ├── execution/           # Engine (DAG execution)
│   │   │   ├── validation/          # Workflow validation
│   │   │   └── llm/                 # LLM node handler
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── validators.ts
│   ├── migrations/                  # Database schemas
│   ├── tests/                       # Unit & integration tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   │   ├── DAGEditor.tsx
│   │   │   │   ├── NodePalette.tsx
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── ConfigPanel.tsx
│   │   │   │   └── Toolbar.tsx
│   │   │   ├── execution/
│   │   │   │   ├── ExecutionDashboard.tsx
│   │   │   │   ├── ExecutionTimeline.tsx
│   │   │   │   └── LogViewer.tsx
│   │   │   └── shared/
│   │   ├── pages/
│   │   │   ├── editor.tsx
│   │   │   └── executions.tsx
│   │   ├── hooks/
│   │   │   ├── useWorkflow.ts
│   │   │   └── useExecution.ts
│   │   ├── store/                  # Zustand state management
│   │   └── api/                    # API client
│   ├── public/
│   └── package.json
├── workers/                        # Execution workers
│   ├── src/
│   │   ├── executor.ts             # Main worker loop
│   │   ├── nodes/                  # Node type executors
│   │   │   ├── llm.ts
│   │   │   ├── code.ts
│   │   │   ├── http.ts
│   │   │   └── conditional.ts
│   │   └── sandbox/                # Isolated execution
│   └── package.json
├── docs/
│   └── ARCHITECTURE.md
└── README.md
```

## Core Concepts

### Node Types

1. **Trigger** (⚡): Starts workflow
   - Webhook, Cron, Manual, Event
   - Each workflow has exactly one trigger

2. **LLM Call** (🤖): AI model invocation
   - Supports GPT-4o, Claude 3.5, Gemini 1.5
   - Prompt templating with variable interpolation
   - Structured output validation
   - Cost estimation

3. **Code Executor** ({}): Sandboxed code
   - JavaScript (vm2) or Python (subprocess)
   - Access to node inputs
   - No file system/unconstrained network access
   - Timeout protection (default 30s)

4. **HTTP Request** (🌐): External API call
   - GET, POST, PUT, DELETE
   - Headers, auth, request body templates
   - Response parsing and error handling

5. **Data Transform** (⚙️): JSONata transformations
   - Map, filter, aggregate data
   - Access to all upstream node outputs
   - Schema validation

6. **Conditional** (🔀): Branch on boolean expression
   - Routes to different paths based on condition
   - Multiple branches supported
   - Default path if no condition matches

7. **Human Approval** (👤): Pause and wait
   - Sends approval request to user(s)
   - Optional deadline/reminder
   - Resume or reject actions

8. **Sub-Workflow** (📦): Nested reusable workflow
   - Call other workflows with input mapping
   - Composability for large DAGs

9. **Aggregator** (🔗): Merge parallel branches
   - Combines outputs from multiple upstream nodes
   - Useful after conditional splits

10. **Delay** (⏱️): Wait for duration or time
    - Fixed delay or cron-like scheduling
    - Useful for rate limiting or scheduled steps

### Data Flow Model

Each node has:
- **Input**: Received from triggers or upstream nodes
- **Processing**: Node-specific logic
- **Output**: Result propagated downstream

Template syntax:
```javascript
{{ nodes.my_node_id.output.field_name }}
{{ input.param }}
{{ env.API_KEY }}
```

### Execution Model

**Execution States**:
- `QUEUED`: Waiting to be picked up
- `RUNNING`: Currently executing
- `COMPLETED`: Finished successfully
- `FAILED`: Error occurred
- `TIMED_OUT`: Exceeded timeout
- `CANCELLED`: User cancel

**DAG Execution**:
1. Trigger fires (webhook, cron, manual, event)
2. Execution record created in QUEUED state
3. Job enqueued in BullMQ
4. Worker picks up job
5. Topological sort of DAG → execution plan
6. For each wave of parallel nodes, spawn concurrent executors
7. Mark execution COMPLETED when all nodes done
8. Emit completion events → trigger downstream workflows

## Development Workflow

### 1. Create a New Workflow

```typescript
// POST /api/workflows
const workflow = await fetch('http://localhost:3000/api/workflows', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-workspace-id': 'ws_123'
  },
  body: JSON.stringify({
    name: 'Customer Data Pipeline',
    description: 'Processes customer data from Stripe'
  })
});

// Response:
// {
//   id: "wf_xyz",
//   workspace_id: "ws_123",
//   nodes: [],
//   edges: [],
//   created_at: "2026-03-24T..."
// }
```

### 2. Add Nodes to Workflow

```typescript
// PUT /api/workflows/wf_xyz
const updated = await fetch('http://localhost:3000/api/workflows/wf_xyz', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-workspace-id': 'ws_123'
  },
  body: JSON.stringify({
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        label: 'Webhook Trigger',
        config: { trigger_type: 'webhook' }
      },
      {
        id: 'llm_1',
        type: 'llm_call',
        label: 'Summarize Data',
        config: {
          model: 'gpt-4o',
          prompt: 'Summarize: {{input.data}}',
          temperature: 0.7
        }
      },
      {
        id: 'http_1',
        type: 'http_request',
        label: 'Save to CRM',
        config: {
          method: 'POST',
          url: 'https://api.salesforce.com/records',
          body: '{ "summary": "{{nodes.llm_1.output.summary}}" }'
        }
      }
    ],
    edges: [
      { source: 'trigger_1', target: 'llm_1' },
      { source: 'llm_1', target: 'http_1' }
    ]
  })
});
```

### 3. Validate Workflow

**Validation Checks**:
- ✅ No cycles (DAG property)
- ✅ No disconnected nodes
- ✅ All required fields present
- ✅ Valid template syntax
- ✅ Model availability
- ✅ Resource quotas
- ✅ Credential existence

### 4. Deploy Workflow

```typescript
// POST /api/workflows/wf_xyz/versions/v1/deploy
const deployment = await fetch('http://localhost:3000/api/workflows/wf_xyz/versions/v1/deploy', {
  method: 'POST',
  headers: {
    'x-workspace-id': 'ws_123'
  },
  body: JSON.stringify({
    environment: 'production',
    canary_percentage: 0  // 0 = full deployment
  })
});
```

### 5. Trigger Execution

```typescript
// Option 1: Manual trigger
const execution = await fetch('http://localhost:3000/api/executions/wf_xyz/run', {
  method: 'POST',
  headers: {
    'x-workspace-id': 'ws_123',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: { data: 'customer data' }
  })
});

// Option 2: Webhook (automatic)
// POST https://hooks.stratos.dev/meridian/ws_123/wf_xyz
// With HMAC-SHA256 signature in X-Stratos-Signature header
```

### 6. Monitor Execution

```typescript
// Get execution status
const execution = await fetch('http://localhost:3000/api/executions/exec_abc', {
  headers: { 'x-workspace-id': 'ws_123' }
});

// Response includes:
// {
//   id: 'exec_abc',
//   workflow_id: 'wf_xyz',
//   status: 'RUNNING',
//   node_executions: [
//     { node_id: 'trigger_1', status: 'COMPLETED', duration_ms: 0 },
//     { node_id: 'llm_1', status: 'RUNNING', duration_ms: 1200 }
//   ],
//   started_at: '2026-03-24T10:30:00Z',
//   progress: 0.33
// }
```

## Key Implementation Details

### Workflow Versioning

Every save creates an immutable version:

```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  version_number INT,          -- Auto-increment
  nodes JSONB,
  edges JSONB,
  change_summary TEXT,
  created_by UUID,
  created_at TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE TABLE workflow_deployments (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  version_id UUID NOT NULL,
  environment VARCHAR(50),     -- dev, staging, prod
  deployed_at TIMESTAMP,
  deployed_by UUID,
  canary_percentage INT DEFAULT 0,
  is_active BOOL DEFAULT true,
  FOREIGN KEY (version_id) REFERENCES workflow_versions(id)
);
```

### Execution Engine

The execution engine is the most complex component:

```typescript
// src/services/execution/executor.ts

async function executeDAG(workflow: Workflow): void {
  // 1. Topological sort
  const executionPlan = topologicalSort(workflow.nodes, workflow.edges);
  
  // 2. For each wave (layer) of nodes
  for (const wave of executionPlan) {
    const promises = wave.map(nodeId => executeNode(nodeId));
    const results = await Promise.all(promises);
    
    // Store results for downstream nodes
    storeNodeResults(results);
  }
  
  // 3. Mark execution complete
  updateExecutionStatus('COMPLETED');
}

async function executeNode(nodeId: string): Promise<NodeResult> {
  const node = workflow.nodes.find(n => n.id === nodeId);
  const handler = getNodeHandler(node.type);
  
  try {
    const input = buildNodeInput(node);
    const output = await handler.execute(input, node.config);
    
    // Emit real-time event
    emitExecutionEvent({
      executionId,
      nodeId,
      status: 'COMPLETED',
      output,
      duration_ms: timeTaken
    });
    
    return { nodeId, status: 'COMPLETED', output };
  } catch (error) {
    // Handle error with retry policy
    if (shouldRetry(node.config.retry)) {
      return retryNodeExecution(nodeId, error);
    }
    
    // Emit failure
    emitExecutionEvent({
      executionId,
      nodeId,
      status: 'FAILED',
      error: error.message
    });
    
    return { nodeId, status: 'FAILED', error };
  }
}
```

### LLM Node Implementation

```typescript
// src/services/execution/nodes/llm.ts

async function executeLLMNode(
  input: Record<string, any>,
  config: LLMNodeConfig
): Promise<Record<string, any>> {
  // 1. Interpolate template
  const prompt = interpolateTemplate(config.prompt, input);
  
  // 2. Resolve model
  const model = await resolveModel(config.model, workspace);
  
  // 3. Call API
  const response = await openai.createChatCompletion({
    model: config.model,
    messages: [
      { role: 'system', content: config.system_prompt },
      { role: 'user', content: prompt }
    ],
    temperature: config.temperature,
    max_tokens: config.max_tokens
  });
  
  // 4. Parse response
  let output = response.choices[0].message.content;
  
  // 5. Validate against schema (if structured output)
  if (config.schema) {
    output = validateJSON(output, config.schema);
  }
  
  // 6. Track cost
  trackTokenUsage(model, response.usage);
  
  return { text: output, tokens: response.usage.total_tokens };
}
```

### Real-Time Execution Dashboard

Uses Server-Sent Events (SSE) for pushing updates:

```typescript
// src/routes/executions.ts

router.get('/:executionId/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Subscribe to Redis channel for this execution
  const channel = `execution:${executionId}:events`;
  subscriber.subscribe(channel);
  
  subscriber.on('message', (ch, message) => {
    res.write(`data: ${message}\n\n`);
  });
  
  // Cleanup on disconnect
  req.on('close', () => {
    subscriber.unsubscribe(channel);
  });
});
```

## Testing

### Unit Tests

```bash
npm test
```

Tests should cover:
- Workflow validation logic
- Node execution handlers
- Template interpolation
- Credential encryption/decryption
- Retry logic
- Error handling

### Integration Tests

```bash
npm run test:integration
```

Test full workflows end-to-end:
- Create workflow → Add nodes → Deploy → Execute
- Verify execution results match expectations
- Check real-time events via SSE
- Validate database state

### Load Testing

```bash
npm run test:load
```

Load test with k6:
- 100 concurrent workflow executions
- Verify execution queue performance
- Measure API latency under load

##API Reference Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/:id` | Get workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/executions/:wfId/run` | Trigger execution |
| GET | `/api/executions/:execId` | Get execution status |
| GET | `/api/executions/:execId/stream` | Stream execution events (SSE) |
| POST | `/api/triggers/webhook/:wfId` | Webhook trigger |
| GET/POST | `/api/credentials` | Manage credentials |

## Performance Optimization

1. **Execution Parallelization**: Parallel nodes run concurrently
2. **Caching**: Workflow definitions cached in Redis
3. **Database Indexing**: Indexes on workspace_id, org_id
4. **Lazy Loading**: Only load active workflow versions
5. **Connection Pooling**: Database connections pooled with max=20

## Security Considerations

1. **Credential Encryption**: AES-256-GCM encryption at rest
2. **Workspace Isolation**: All queries filtered by workspace_id
3. **HMAC Verification**: Webhook requests verified with signature
4. **Sandbox Isolation**: Code executor runs in isolated VM with no network
5. **Rate Limiting**: Per-workspace execution quota

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Workflow not executing | Trigger not active | Check deployment status |
| Nodes timing out | Long-running code | Increase timeout or optimize code |
| Template vars not working | Wrong syntax | Use `{{ nodes.id.output.field }}` |
| Credential not found | Not stored in vault | Navigate to Credentials and add |
| Cyclic workflow error | Feedback edges | Remove edges to create DAG |

## Next Steps

1. Implement React Flow canvas component for node dragging
2. Add visual workflow validation with highlighted errors
3. Build real-time log streaming frontend
4. Implement workflow versioning UI with diff view
5. Add code syntax highlighting in node config panels
6. Build execution replay functionality
7. Implement workflow templates for common patterns

---

**Last Updated**: March 24, 2026
