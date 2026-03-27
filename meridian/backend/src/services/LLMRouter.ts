import { logger } from '../utils/logger';

export interface LLMRequest {
  model?: string;
  provider?: string;
  prompt: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  variables?: Record<string, string>;
  routing_strategy?: 'cheapest' | 'fastest' | 'quality' | 'fallback';
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number; total: number };
  cost_usd: number;
  latency_ms: number;
  finish_reason: string;
}

interface ModelConfig {
  provider: string;
  model_id: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  avg_latency_ms: number;
  quality_score: number; // 1-10
  max_tokens: number;
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'gpt-4o': {
    provider: 'openai', model_id: 'gpt-4o',
    cost_per_1k_input: 0.005, cost_per_1k_output: 0.015,
    avg_latency_ms: 2000, quality_score: 9.5, max_tokens: 128000,
  },
  'gpt-4o-mini': {
    provider: 'openai', model_id: 'gpt-4o-mini',
    cost_per_1k_input: 0.00015, cost_per_1k_output: 0.0006,
    avg_latency_ms: 800, quality_score: 8, max_tokens: 128000,
  },
  'claude-3-5-sonnet': {
    provider: 'anthropic', model_id: 'claude-3-5-sonnet-20241022',
    cost_per_1k_input: 0.003, cost_per_1k_output: 0.015,
    avg_latency_ms: 1500, quality_score: 9.5, max_tokens: 200000,
  },
  'claude-3-5-haiku': {
    provider: 'anthropic', model_id: 'claude-3-5-haiku-20241022',
    cost_per_1k_input: 0.001, cost_per_1k_output: 0.005,
    avg_latency_ms: 600, quality_score: 7.5, max_tokens: 200000,
  },
  'gemini-2.0-flash': {
    provider: 'google', model_id: 'gemini-2.0-flash',
    cost_per_1k_input: 0.0001, cost_per_1k_output: 0.0004,
    avg_latency_ms: 500, quality_score: 8, max_tokens: 1048576,
  },
};

export class LLMRouter {
  private modelConfigs: Record<string, ModelConfig>;

  constructor() {
    this.modelConfigs = { ...MODEL_REGISTRY };
  }

  /**
   * Select the best model based on routing strategy
   */
  selectModel(strategy: string = 'quality'): ModelConfig {
    const models = Object.values(this.modelConfigs);

    switch (strategy) {
      case 'cheapest':
        return models.reduce((a, b) => a.cost_per_1k_input < b.cost_per_1k_input ? a : b);
      case 'fastest':
        return models.reduce((a, b) => a.avg_latency_ms < b.avg_latency_ms ? a : b);
      case 'quality':
        return models.reduce((a, b) => a.quality_score > b.quality_score ? a : b);
      case 'fallback':
        // Primary: GPT-4o, Fallback: Claude, Fallback: Gemini
        return this.modelConfigs['gpt-4o'] || this.modelConfigs['claude-3-5-sonnet'] || models[0];
      default:
        return this.modelConfigs['gpt-4o-mini'] || models[0];
    }
  }

  /**
   * Resolve prompt template variables
   */
  resolvePrompt(template: string, variables: Record<string, string>): string {
    let resolved = template;
    for (const [key, value] of Object.entries(variables)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return resolved;
  }

  /**
   * Execute an LLM call (mock implementation)
   * In production: route to OpenAI/Anthropic/Google SDKs based on selected model
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // Select model
    let modelConfig: ModelConfig;
    if (request.model && this.modelConfigs[request.model]) {
      modelConfig = this.modelConfigs[request.model];
    } else {
      modelConfig = this.selectModel(request.routing_strategy || 'quality');
    }

    // Resolve variables in prompt
    const resolvedPrompt = request.variables
      ? this.resolvePrompt(request.prompt, request.variables)
      : request.prompt;

    logger.info(`LLM call: model=${modelConfig.model_id}, prompt_length=${resolvedPrompt.length}`);

    // Mock: simulate LLM response
    // In production: call the actual provider SDK
    const responseText = `[Mock LLM Response from ${modelConfig.model_id}] ` +
      `Processed prompt of ${resolvedPrompt.length} chars. ` +
      `This would contain the actual model output in production.`;

    const promptTokens = Math.ceil(resolvedPrompt.length / 4);
    const completionTokens = Math.ceil(responseText.length / 4);
    const totalTokens = promptTokens + completionTokens;

    const cost = (promptTokens / 1000 * modelConfig.cost_per_1k_input) +
                 (completionTokens / 1000 * modelConfig.cost_per_1k_output);

    const latency = Date.now() - startTime + Math.random() * modelConfig.avg_latency_ms;

    return {
      text: responseText,
      model: modelConfig.model_id,
      provider: modelConfig.provider,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens,
      },
      cost_usd: Math.round(cost * 100000) / 100000,
      latency_ms: Math.round(latency),
      finish_reason: 'stop',
    };
  }

  /**
   * Get cost estimation for a model
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const config = this.modelConfigs[model];
    if (!config) return 0;
    return (inputTokens / 1000 * config.cost_per_1k_input) +
           (outputTokens / 1000 * config.cost_per_1k_output);
  }

  /**
   * List available models with their specs
   */
  listModels(): Array<ModelConfig & { name: string }> {
    return Object.entries(this.modelConfigs).map(([name, config]) => ({ name, ...config }));
  }
}

export const llmRouter = new LLMRouter();
