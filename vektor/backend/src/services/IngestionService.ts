import { logger } from '../utils/logger';
import { DataSourceModel } from '../models/DataSource';
import { SyncJobModel } from '../models/DataSource';

export interface ChunkingConfig {
  strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic';
  chunk_size: number;
  chunk_overlap: number;
}

export interface IngestionResult {
  job_id: string;
  documents_processed: number;
  chunks_created: number;
  errors: any[];
  duration_ms: number;
}

export class IngestionService {
  /**
   * Full ingestion pipeline: extract → clean → chunk → embed → store
   *
   * In production:
   * 1. Extract content from data source (via connector)
   * 2. Clean and normalize text
   * 3. Chunk documents using selected strategy
   * 4. Generate embeddings via OpenAI/Cohere
   * 5. Store vectors in pgvector
   */
  static async ingest(
    datasourceId: string,
    orgId: string,
    chunkingConfig?: ChunkingConfig
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const config = chunkingConfig || { strategy: 'sentence', chunk_size: 512, chunk_overlap: 50 };

    // Create sync job
    const job = await SyncJobModel.create(datasourceId, orgId);
    logger.info(`Starting ingestion job ${job.id} for datasource ${datasourceId}`);

    // Update datasource status
    await DataSourceModel.updateStatus(datasourceId, 'running');

    try {
      // Step 1: Extract documents
      const documents = await this.extractDocuments(datasourceId);
      logger.info(`Extracted ${documents.length} documents`);

      // Step 2: Process each document
      let totalChunks = 0;
      const errors: any[] = [];

      for (let i = 0; i < documents.length; i++) {
        try {
          // Clean text
          const cleanedText = this.cleanText(documents[i].content);

          // Chunk
          const chunks = this.chunkText(cleanedText, config);

          // Embed chunks (mock)
          const embeddings = await this.embedChunks(chunks);

          // Store in pgvector (mock — logged only)
          totalChunks += chunks.length;

          // Update progress
          const progress = (i + 1) / documents.length;
          await SyncJobModel.updateProgress(job.id, progress, {
            documents_processed: i + 1,
            chunks_created: totalChunks,
          });
        } catch (err: any) {
          errors.push({
            document: documents[i].id,
            error: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Update datasource stats
      await DataSourceModel.updateStatus(datasourceId, 'completed', {
        total_documents: documents.length,
        total_chunks: totalChunks,
      });

      const durationMs = Date.now() - startTime;
      logger.info(`Ingestion complete: ${documents.length} docs, ${totalChunks} chunks, ${durationMs}ms`);

      return {
        job_id: job.id,
        documents_processed: documents.length,
        chunks_created: totalChunks,
        errors,
        duration_ms: durationMs,
      };

    } catch (error: any) {
      await SyncJobModel.fail(job.id, error.message);
      await DataSourceModel.updateStatus(datasourceId, 'failed');
      throw error;
    }
  }

  /**
   * Extract documents from a data source
   * In production: use the appropriate connector (GitHub API, Confluence API, etc.)
   */
  private static async extractDocuments(datasourceId: string): Promise<Array<{
    id: string; content: string; metadata: Record<string, any>;
  }>> {
    // Mock: return synthetic documents
    return Array.from({ length: 10 }, (_, i) => ({
      id: `doc_${datasourceId}_${i + 1}`,
      content: `This is the content of document ${i + 1}. It contains information about the system architecture, ` +
        `API endpoints, and configuration options. Each document may have multiple pages and sections that need ` +
        `to be properly chunked for effective semantic search.`.repeat(5),
      metadata: {
        filename: `document_${i + 1}.md`,
        source: datasourceId,
        last_modified: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      },
    }));
  }

  /**
   * Clean and normalize text
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, '  ')
      .trim();
  }

  /**
   * Chunk text using the selected strategy
   */
  static chunkText(text: string, config: ChunkingConfig): string[] {
    const chunks: string[] = [];

    switch (config.strategy) {
      case 'fixed': {
        // Fixed-size chunking with overlap
        for (let i = 0; i < text.length; i += config.chunk_size - config.chunk_overlap) {
          chunks.push(text.slice(i, i + config.chunk_size));
          if (i + config.chunk_size >= text.length) break;
        }
        break;
      }

      case 'sentence': {
        // Sentence-boundary chunking
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentChunk = '';

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > config.chunk_size && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            // Keep overlap
            const overlapSentences = currentChunk.split(/(?<=[.!?])\s+/).slice(-2).join(' ');
            currentChunk = overlapSentences + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        break;
      }

      case 'paragraph': {
        // Paragraph-based chunking
        const paragraphs = text.split('\n\n');
        let currentChunk = '';

        for (const para of paragraphs) {
          if (currentChunk.length + para.length > config.chunk_size && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = para;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
          }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        break;
      }

      case 'semantic':
      default:
        // Fallback to sentence chunking for semantic
        return this.chunkText(text, { ...config, strategy: 'sentence' });
    }

    return chunks.filter(c => c.length > 10);
  }

  /**
   * Generate embeddings for chunks
   * In production: call OpenAI text-embedding-3-small or Cohere embed-v3
   */
  private static async embedChunks(chunks: string[]): Promise<number[][]> {
    // Mock: return synthetic embedding vectors
    return chunks.map(() =>
      Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
    );
  }
}
