# Meridian - Execution Engine Deep Dive

Complete technical documentation of the Meridian execution engine architecture.

## Execution Engine Overview

The Meridian execution engine is a distributed, fault-tolerant system for executing DAG-based workflows with real-time monitoring and comprehensive logging.

## Architecture

### Components

```
┌─────────────────────────────────────────┐
│         Execution API Layer             │
│  - Receive execution requests           │
│  - Validate workflow definition         │
│  - Create execution records             │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Job Queue (BullMQ)                 │
│  - Enqueue execution jobs               │
│  - Handle retries                       │
│  - Track job status                     │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│    Execution Workers (Node.js)          │
│  - Poll job queue                       │
│  - Deserialize workflow                 │
│  - Execute topologically                │
│  - Store execution state                │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│    Node Executors (Type-Specific)       │
│  - LLM Node Executor                    │
│  - HTTP Node Executor                   │
│  - Database Node Executor               │
│  - Condition Node Executor              │
│  - Code Node Executor                   │
└─────────────────────────────────────────┘
```

### Execution Lifecycle

```
1. QUEUED
   ├─ Workflow received
   ├─ Validation passed
   └─ Job enqueued in Redis
   
2. RUNNING
   ├─ Worker picks up job
   ├─ Execution starts
   ├─ Nodes execute topologically
   └─ Real-time status updates
   
3. COMPLETED/FAILED/CANCELLED
   ├─ Execution resolved
   ├─ Results stored
   ├─ Logs finalized
   └─ Cleanup performed
```

## Topological Execution

### Dependency Resolution

```typescript
function topologicalSort(nodes: Node[], edges: Edge[]): Node[][] {
  // Returns array of node levels
  // Level 0: No dependencies
  // Level 1: Depends on Level 0
  // Level N: Depends on Level N-1
  
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  // Build adjacency list
  for (const edge of edges) {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
  }
  
  // Calculate in-degrees
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const [source, targets] of adjacencyList) {
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  }
  
  // Kahn's algorithm
  const queue = [];
  const levels: Node[][] = [];
  
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      const node = nodes.find(n => n.id === nodeId);
      queue.push(node);
    }
  }
  
  while (queue.length > 0) {
    const currentLevel = [...queue];
    levels.push(currentLevel);
    queue.length = 0;
    
    for (const node of currentLevel) {
      const targets = adjacencyList.get(node.id) || [];
      for (const targetId of targets) {
        const newDegree = inDegree.get(targetId) - 1;
        inDegree.set(targetId, newDegree);
        
        if (newDegree === 0) {
          const targetNode = nodes.find(n => n.id === targetId);
          queue.push(targetNode);
        }
      }
    }
  }
  
  return levels;
}
```

### Parallel Execution

Nodes at the same level execute in parallel:

```typescript
async function executeLevel(level: Node[], context: ExecutionContext) {
  const promises = level.map(node => 
    executeNode(node, context)
      .catch(error => ({
        nodeId: node.id,
        error: error,
        status: 'FAILED'
      }))
  );
  
  const results = await Promise.all(promises);
  
  // Update context with results
  for (const result of results) {
    context.nodeResults.set(result.nodeId, result);
  }
  
  return results;
}
```

## Node Execution

### Universal Node Execution Pattern

```typescript
interface NodeExecutor {
  execute(
    node: Node,
    input: any,
    context: ExecutionContext
  ): Promise<NodeExecutionResult>;
}

class LLMNodeExecutor implements NodeExecutor {
  async execute(node: Node, input: any, context: ExecutionContext) {
    const startTime = Date.now();
    
    try {
      // 1. Resolve credentials
      const credentials = await resolveCredentials(
        node.config.credential_id,
        context.orgId
      );
      
      // 2. Template prompt with variables
      const prompt = templatePrompt(
        node.config.prompt,
        input,
        context.nodeResults
      );
      
      // 3. Route to model
      const model = selectModel(
        node.config.model_selection_strategy,
        node.config.models
      );
      
      // 4. Call LLM
      const response = await callLLM(model, prompt, credentials);
      
      // 5. Parse response
      const output = parseOutput(response, node.config.output_format);
      
      // 6. Record metrics
      const duration = Date.now() - startTime;
      recordMetrics({
        execution_id: context.executionId,
        node_id: node.id,
        model: model,
        tokens_used: response.usage.total_tokens,
        latency_ms: duration
      });
      
      return {
        nodeId: node.id,
        status: 'SUCCEEDED',
        output: output,
        duration_ms: duration
      };
      
    } catch (error) {
      return {
        nodeId: node.id,
        status: 'FAILED',
        error: error.message,
        duration_ms: Date.now() - startTime
      };
    }
  }
}
```

## Error Handling & Retries

### Retry Strategy

```typescript
interface RetryPolicy {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

async function executeWithRetry(
  nodeId: string,
  executor: () => Promise<any>,
  policy: RetryPolicy
): Promise<any> {
  let attempt = 0;
  let lastError: Error;
  
  while (attempt < policy.max_retries) {
    try {
      return await executor();
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt >= policy.max_retries) break;
      
      const delayMs = Math.min(
        policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1),
        policy.max_delay_ms
      );
      
      logger.warn(`Node ${nodeId} failed, retrying in ${delayMs}ms`, {
        attempt,
        error: error.message
      });
      
      await sleep(delayMs);
    }
  }
  
  throw new ExecutionError(
    `Node ${nodeId} failed after ${policy.max_retries} attempts: ${lastError.message}`,
    nodeId,
    lastError
  );
}
```

### Error Propagation

```typescript
async function executeWorkflow(execution: Execution) {
  const levels = topologicalSort(execution.nodes, execution.edges);
  
  for (const level of levels) {
    const results = await executeLevel(level, context);
    
    // Check for failures
    const failures = results.filter(r => r.status === 'FAILED');
    
    if (failures.length > 0) {
      // Get error handling config
      const errorHandling = execution.config.error_handling;
      
      if (errorHandling === 'STOP') {
        // Stop entire workflow
        return {
          status: 'FAILED',
          error: failures[0].error
        };
      } else if (errorHandling === 'CONTINUE') {
        // Mark failed nodes but continue
        logger.error('Nodes failed but continuing', { failures });
      } else if (errorHandling === 'PARTIAL_RETRY') {
        // Retry only failed nodes
        for (const failure of failures) {
          const retried = await retryNode(failure.nodeId, context);
          if (retried.status === 'FAILED') {
            return { status: 'FAILED', error: retried.error };
          }
        }
      }
    }
  }
}
```

## State Management

### Execution Context

```typescript
interface ExecutionContext {
  executionId: string;
  workflowId: string;
  orgId: string;
  workspaceId: string;
  
  // Node results by node ID
  nodeResults: Map<string, any>;
  
  // Execution variables
  variables: Map<string, any>;
  
  // Timestamps
  startedAt: Date;
  
  // Configuration
  timeout_seconds: number;
  max_parallel_nodes: number;
  
  // Logging
  logger: Logger;
}
```

### State Persistence

Execution state stored in PostgreSQL:

```sql
-- Execution record
INSERT INTO executions (
  id, workflow_id, org_id, status, 
  started_at, completed_at, duration_ms
) VALUES (...);

-- Per-node execution record
INSERT INTO execution_nodes (
  id, execution_id, node_id, status,
  input_data, output_data, duration_ms
) VALUES (...);

-- Execution logs
INSERT INTO execution_logs (
  execution_id, node_id, level, message, timestamp
) VALUES (...);
```

## Monitoring & Observability

### Node Execution Metrics

```typescript
interface NodeMetrics {
  node_id: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
}

// Emit metrics to monitoring system
function recordNodeMetrics(metrics: NodeMetrics) {
  prometheus.histogram('node_execution_duration_ms', metrics.avg_duration_ms, {
    node_id: metrics.node_id
  });
  
  prometheus.counter('node_executions_total', metrics.execution_count, {
    node_id: metrics.node_id
  });
  
  prometheus.counter('node_failures_total', metrics.failure_count, {
    node_id: metrics.node_id
  });
}
```

### Real-Time Status Updates

WebSocket streaming of execution progress:

```typescript
async function streamExecutionStatus(
  executionId: string,
  ws: WebSocket
) {
  const subscription = redis.subscribe(`execution:${executionId}:status`);
  
  subscription.on('message', (channel, message) => {
    const event = JSON.parse(message);
    
    ws.send(JSON.stringify({
      type: 'execution_status_update',
      data: {
        execution_id: executionId,
        node_id: event.node_id,
        status: event.status,
        timestamp: new Date(),
        progress: event.progress
      }
    }));
  });
}
```

## Performance Optimization

### Caching

```typescript
// Cache node results for repeated executions
const nodeResultCache = new LRUCache<string, any>({
  max: 10000,
  ttl: 1000 * 60 * 5  // 5 minute TTL
});

async function executeNode(node: Node, context: ExecutionContext) {
  const cacheKey = `${node.id}:${JSON.stringify(node.input)}`;
  
  // Check cache
  const cached = nodeResultCache.get(cacheKey);
  if (cached && node.config.cacheable) {
    logger.info(`Cache hit for node ${node.id}`);
    return cached;
  }
  
  // Execute
  const result = await executor.execute(node, context);
  
  // Store in cache
  if (node.config.cacheable) {
    nodeResultCache.set(cacheKey, result);
  }
  
  return result;
}
```

### Connection Pooling

```typescript
// Database connection pool
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// LLM API connection pool
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});
```

---

**Last Updated**: March 24, 2026
