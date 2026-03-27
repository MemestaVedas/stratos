/**
 * Meridian Worker – BullMQ-based workflow execution worker pool
 *
 * In production, this runs as a separate process (or Kubernetes deployment)
 * and pulls execution jobs from the 'workflow-executions' queue.
 *
 * Architecture:
 * - API enqueues execution jobs with workflow data + input
 * - Workers dequeue and run the DAG execution engine
 * - Results are written back to PostgreSQL
 * - Status updates are published via Redis pub/sub for SSE streaming
 */

import { Worker, Queue, Job, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

// ===== Queues =====

export const executionQueue = new Queue('workflow-executions', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { age: 86400 }, // Remove completed jobs after 24h
    removeOnFail: { age: 604800 },    // Keep failed jobs for 7 days
  },
});

export const scheduledQueue = new Queue('scheduled-triggers', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
  },
});

// ===== Worker =====

const worker = new Worker(
  'workflow-executions',
  async (job: Job) => {
    const { executionId, workflowId, nodes, edges, inputData, orgId } = job.data;

    console.log(`[Worker] Processing execution ${executionId} for workflow ${workflowId}`);

    // In production: import and call ExecutionEngine.executeWorkflow()
    // For now: simulate execution
    const startTime = Date.now();

    // Publish status update via Redis pub/sub
    await connection.publish('execution-updates', JSON.stringify({
      executionId,
      workflowId,
      status: 'running',
      timestamp: new Date().toISOString(),
    }));

    // Simulate node-by-node execution
    const nodeResults = [];
    const nodeList = nodes || [];

    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];
      await job.updateProgress(Math.round(((i + 1) / nodeList.length) * 100));

      // Publish per-node update
      await connection.publish('execution-updates', JSON.stringify({
        executionId,
        type: 'node_complete',
        nodeId: node.id,
        nodeType: node.type,
        status: 'succeeded',
        durationMs: Math.round(Math.random() * 500),
      }));

      nodeResults.push({
        node_id: node.id,
        node_type: node.type,
        status: 'succeeded',
        duration_ms: Math.round(Math.random() * 500),
      });
    }

    const durationMs = Date.now() - startTime;

    // Publish completion
    await connection.publish('execution-updates', JSON.stringify({
      executionId,
      workflowId,
      status: 'completed',
      durationMs,
      nodeCount: nodeResults.length,
      timestamp: new Date().toISOString(),
    }));

    return {
      executionId,
      status: 'completed',
      nodeResults,
      durationMs,
    };
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 100,
      duration: 60000, // Max 100 jobs per minute
    },
  }
);

// ===== Event Handlers =====

worker.on('completed', (job: Job, result: any) => {
  console.log(`[Worker] Execution ${result.executionId} completed in ${result.durationMs}ms`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`[Worker] Job failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error(`[Worker] Worker error:`, error.message);
});

// ===== Scheduled Trigger Worker =====

const scheduledWorker = new Worker(
  'scheduled-triggers',
  async (job: Job) => {
    const { workflowId, orgId, triggerConfig } = job.data;
    console.log(`[Scheduler] Triggering scheduled execution for workflow ${workflowId}`);

    // Queue a new execution
    await executionQueue.add('execute', {
      executionId: `exec_scheduled_${Date.now()}`,
      workflowId,
      nodes: [],
      edges: [],
      inputData: { trigger: 'schedule', scheduled_at: new Date().toISOString() },
      orgId,
    });
  },
  { connection, concurrency: 2 }
);

// ===== Startup =====

console.log(`[Worker] Meridian Worker Pool started`);
console.log(`[Worker] Concurrency: ${CONCURRENCY}`);
console.log(`[Worker] Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`[Worker] Listening on queues: workflow-executions, scheduled-triggers`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await scheduledWorker.close();
  await connection.quit();
  process.exit(0);
});
