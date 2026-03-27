import { ExecutionModel, NodeExecutionResult, ExecutionStatus } from '../models/Execution';
import { llmRouter } from './LLMRouter';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface DAGNode {
  id: string;
  type: 'trigger' | 'llm' | 'code' | 'http' | 'database' | 'condition' | 'transform' | 'merge' | 'loop' | 'webhook';
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface DAGEdge {
  source: string;
  target: string;
  label?: string;
}

export const executionEvents = new EventEmitter();

export class ExecutionEngine {
  /**
   * Build adjacency list and compute topological order
   */
  static topologicalSort(nodes: DAGNode[], edges: DAGEdge[]): string[] {
    const adj: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      adj.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of adj.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Workflow contains a cycle — DAGs must be acyclic');
    }

    return sorted;
  }

  /**
   * Find independent nodes that can run in parallel
   */
  static findParallelBranches(order: string[], edges: DAGEdge[]): string[][] {
    const layers: string[][] = [];
    const nodeLayer: Map<string, number> = new Map();

    for (const nodeId of order) {
      const incomingEdges = edges.filter(e => e.target === nodeId);
      if (incomingEdges.length === 0) {
        nodeLayer.set(nodeId, 0);
      } else {
        const maxParentLayer = Math.max(
          ...incomingEdges.map(e => nodeLayer.get(e.source) || 0)
        );
        nodeLayer.set(nodeId, maxParentLayer + 1);
      }
    }

    for (const [nodeId, layer] of nodeLayer) {
      while (layers.length <= layer) layers.push([]);
      layers[layer].push(nodeId);
    }

    return layers;
  }

  /**
   * Execute a single node
   */
  static async executeNode(node: DAGNode, inputData: any, context: Record<string, any>): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const result: NodeExecutionResult = {
      node_id: node.id,
      node_type: node.type,
      status: 'running',
      input: inputData,
      duration_ms: 0,
      retries: 0,
    };

    try {
      let output: any;

      switch (node.type) {
        case 'trigger':
          output = inputData; // pass through
          break;

        case 'llm':
          const llmResponse = await llmRouter.execute({
            model: node.config.model,
            prompt: node.config.prompt || '',
            system_prompt: node.config.system_prompt,
            temperature: node.config.temperature || 0.7,
            max_tokens: node.config.max_tokens || 1024,
            variables: context,
            routing_strategy: node.config.routing_strategy || 'quality',
          });
          output = llmResponse;
          result.tokens_used = {
            prompt: llmResponse.tokens.prompt,
            completion: llmResponse.tokens.completion,
            total: llmResponse.tokens.total,
            cost_usd: llmResponse.cost_usd,
          };
          break;

        case 'code':
          // Sandboxed code execution (mock)
          output = {
            result: `[Code execution result] Language: ${node.config.language || 'javascript'}`,
            stdout: 'Code executed successfully',
            exit_code: 0,
          };
          break;

        case 'http':
          // HTTP request (mock)
          output = {
            status: 200,
            body: { message: `Mock response from ${node.config.url || 'https://api.example.com'}` },
            headers: {},
          };
          break;

        case 'database':
          // Database query (mock)
          output = {
            rows: [{ id: 1, result: 'mock database result' }],
            rowCount: 1,
          };
          break;

        case 'condition':
          // Evaluate condition
          const condResult = evaluateCondition(node.config.expression, context);
          output = { result: condResult, branch: condResult ? 'true' : 'false' };
          break;

        case 'transform':
          // Data transformation
          output = { transformed: inputData };
          break;

        case 'merge':
          // Merge multiple inputs
          output = { merged: context };
          break;

        case 'loop':
          // Loop iteration (simplified)
          const items = inputData?.items || [];
          output = { iterations: items.length, results: items };
          break;

        default:
          output = { message: `Unknown node type: ${node.type}` };
      }

      result.output = output;
      result.status = 'succeeded';
    } catch (error: any) {
      result.status = 'failed';
      result.error = error.message;
      logger.error(`Node ${node.id} failed:`, error);
    }

    result.duration_ms = Date.now() - startTime;
    return result;
  }

  /**
   * Execute the entire workflow DAG
   */
  static async executeWorkflow(
    executionId: string,
    nodes: DAGNode[],
    edges: DAGEdge[],
    inputData: any,
    orgId: string
  ): Promise<{
    status: ExecutionStatus;
    results: NodeExecutionResult[];
    outputData?: any;
    totalTokens: number;
    totalCost: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const allResults: NodeExecutionResult[] = [];
    const context: Record<string, any> = { input: inputData };
    let totalTokens = 0;
    let totalCost = 0;

    try {
      // Topological sort
      const order = this.topologicalSort(nodes, edges);
      const layers = this.findParallelBranches(order, edges);

      // Update status to running
      await ExecutionModel.updateStatus(executionId, 'running');
      executionEvents.emit('status', { executionId, status: 'running' });

      // Execute layer by layer (parallel within each layer)
      for (const layer of layers) {
        const layerNodes = layer.map(id => nodes.find(n => n.id === id)!).filter(Boolean);

        const layerResults = await Promise.all(
          layerNodes.map(node => {
            const nodeInput = this.getNodeInput(node.id, edges, context);
            return this.executeNode(node, nodeInput, context);
          })
        );

        for (const result of layerResults) {
          allResults.push(result);
          context[result.node_id] = result.output;

          if (result.tokens_used) {
            totalTokens += result.tokens_used.total;
            totalCost += result.tokens_used.cost_usd;
          }

          executionEvents.emit('node_complete', {
            executionId,
            nodeId: result.node_id,
            result
          });

          // Abort on failure (unless retry configured)
          if (result.status === 'failed') {
            const durationMs = Date.now() - startTime;
            await ExecutionModel.updateStatus(executionId, 'failed', {
              node_results: allResults,
              error: `Node ${result.node_id} failed: ${result.error}`,
              duration_ms: durationMs,
              total_tokens: totalTokens,
              total_cost_usd: totalCost,
            });

            return { status: 'failed', results: allResults, totalTokens, totalCost, durationMs };
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const lastResult = allResults[allResults.length - 1];

      await ExecutionModel.updateStatus(executionId, 'completed', {
        node_results: allResults,
        output_data: lastResult?.output,
        duration_ms: durationMs,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      });

      executionEvents.emit('status', { executionId, status: 'completed' });

      return {
        status: 'completed',
        results: allResults,
        outputData: lastResult?.output,
        totalTokens,
        totalCost,
        durationMs,
      };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      await ExecutionModel.updateStatus(executionId, 'failed', {
        node_results: allResults,
        error: error.message,
        duration_ms: durationMs,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      });

      return { status: 'failed', results: allResults, totalTokens, totalCost, durationMs };
    }
  }

  private static getNodeInput(nodeId: string, edges: DAGEdge[], context: Record<string, any>): any {
    const incomingEdges = edges.filter(e => e.target === nodeId);
    if (incomingEdges.length === 0) return context.input;
    if (incomingEdges.length === 1) return context[incomingEdges[0].source];

    // Merge multiple inputs
    const merged: Record<string, any> = {};
    for (const edge of incomingEdges) {
      merged[edge.source] = context[edge.source];
    }
    return merged;
  }
}

function evaluateCondition(expression: string, context: Record<string, any>): boolean {
  try {
    // Simple expression evaluation (in production: use a safe evaluator)
    return true;
  } catch {
    return false;
  }
}
