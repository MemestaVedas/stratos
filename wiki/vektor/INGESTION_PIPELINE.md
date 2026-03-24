# Vektor - Ingestion Pipeline Deep Dive

Technical documentation of the Vektor data ingestion and chunking pipeline.

## Ingestion Pipeline Architecture

```
┌──────────────────┐
│  Data Source     │
│  (GitHub, etc)   │
└────────┬─────────┘
         │
┌────────▼──────────────────┐
│   Connector Module         │
│   - Authentication         │
│   - Document Discovery     │
│   - Pagination Handling    │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│   Document Normalizer      │
│   - Parse formats          │
│   - Extract metadata       │
│   - Handle encoding        │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│   Chunker Module           │
│   - Split by strategy      │
│   - Overlap handling       │
│   - Size enforcement       │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│   Embedding Service        │
│   - Generate vectors       │
│   - Batch processing       │
│   - Error handling         │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│   Vector Indexer           │
│   - Store in pgvector      │
│   - Build HNSW index       │
│   - Update metadata        │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│   Index / Ready for Query  │
└────────────────────────────┘
```

## Connector Layer

### GitHub Connector Implementation

```typescript
class GitHubConnector implements DataSourceConnector {
  private client: Octokit;
  
  async authenticate(config: GitHubConnectorConfig) {
    this.client = new Octokit({
      auth: config.personal_access_token
    });
  }
  
  async discover(config: GitHubConnectorConfig): Promise<Document[]> {
    const documents: Document[] = [];
    
    // List all files in repository
    const { data } = await this.client.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path || ''
    });
    
    for (const item of data) {
      if (item.type === 'file') {
        // Filter by include patterns
        if (this.matchesPattern(item.path, config.include_patterns)) {
          documents.push({
            source_id: item.sha,
            source_type: 'github',
            title: item.name,
            url: item.html_url,
            content: await this.fetchFileContent(item),
            metadata: {
              repository: `${config.owner}/${config.repo}`,
              file_path: item.path,
              last_modified: item.commit.author.date
            }
          });
        }
      }
    }
    
    return documents;
  }
  
  private async fetchFileContent(item: any): Promise<string> {
    const response = await fetch(item.download_url);
    return await response.text();
  }
}
```

## Chunking Strategies

### Fixed-Size Chunking

```typescript
class FixedSizeChunker implements ChunkingStrategy {
  constructor(
    private chunkSize: number = 1024,
    private overlapPercentage: number = 10
  ) {}
  
  chunk(document: Document): Chunk[] {
    const chunks: Chunk[] = [];
    const content = document.content;
    const overlapSize = Math.floor(this.chunkSize * this.overlapPercentage / 100);
    
    let start = 0;
    let chunkNumber = 0;
    
    while (start < content.length) {
      const end = Math.min(start + this.chunkSize, content.length);
      const chunkContent = content.substring(start, end);
      
      chunks.push({
        chunk_number: chunkNumber++,
        content: chunkContent,
        source_id: document.source_id,
        metadata: {
          chunk_size: chunkContent.length,
          start_position: start,
          end_position: end
        }
      });
      
      start = end - overlapSize;
    }
    
    return chunks;
  }
}
```

### Sentence-Boundary Chunking

```typescript
class SentenceBoundaryChunker implements ChunkingStrategy {
  constructor(
    private maxChunkSize: number = 2048,
    private sentenceRegex: RegExp = /[.!?]+/g
  ) {}
  
  chunk(document: Document): Chunk[] {
    const chunks: Chunk[] = [];
    const content = document.content;
    
    // Split by sentences
    const sentences = this.splitBySentences(content);
    
    let currentChunk = '';
    let chunkNumber = 0;
    
    for (const sentence of sentences) {
      // Add sentence to chunk
      if (currentChunk.length + sentence.length <= this.maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        // Save current chunk and start new one
        if (currentChunk) {
          chunks.push({
            chunk_number: chunkNumber++,
            content: currentChunk,
            source_id: document.source_id
          });
        }
        currentChunk = sentence;
      }
    }
    
    // Save final chunk
    if (currentChunk) {
      chunks.push({
        chunk_number: chunkNumber,
        content: currentChunk,
        source_id: document.source_id
      });
    }
    
    return chunks;
  }
  
  private splitBySentences(text: string): string[] {
    return text.match(/[^.!?]*[.!?]+/g) || [];
  }
}
```

### Semantic Chunking

```typescript
class SemanticChunker implements ChunkingStrategy {
  constructor(
    private embeddingService: EmbeddingService,
    private similarityThreshold: number = 0.7
  ) {}
  
  async chunk(document: Document): Promise<Chunk[]> {
    const sentences = this.splitBySentences(document.content);
    
    // Generate embeddings for all sentences
    const embeddings = await this.embeddingService.embed(sentences);
    
    const chunks: Chunk[] = [];
    let currentChunk = [];
    let currentEmbedding: number[];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const embedding = embeddings[i];
      
      if (currentChunk.length === 0) {
        // Start new chunk
        currentChunk.push(sentence);
        currentEmbedding = embedding;
      } else {
        // Calculate similarity
        const similarity = cosineSimilarity(currentEmbedding, embedding);
        
        if (similarity > this.similarityThreshold) {
          // Add to current chunk (semantically similar)
          currentChunk.push(sentence);
        } else {
          // Start new chunk (semantic boundary)
          chunks.push({
            chunk_number: chunks.length,
            content: currentChunk.join(' '),
            source_id: document.source_id
          });
          
          currentChunk = [sentence];
          currentEmbedding = embedding;
        }
      }
    }
    
    // Save final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        chunk_number: chunks.length,
        content: currentChunk.join(' '),
        source_id: document.source_id
      });
    }
    
    return chunks;
  }
}
```

## Embedding Service

### Batch Embedding with Rate Limiting

```typescript
class EmbeddingService {
  constructor(private client: OpenAI) {}
  
  async embed(texts: string[], batchSize: number = 100): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // Process in batches to manage rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch
        });
        
        // Sort by index to maintain order
        const sorted = response.data.sort((a, b) => a.index - b.index);
        embeddings.push(...sorted.map(item => item.embedding));
        
      } catch (error) {
        if (error.status === 429) {
          // Rate limited - backoff
          await this.sleep(5000);
          i -= batchSize;  // Retry batch
        } else {
          throw error;
        }
      }
      
      // Small delay between batches
      await this.sleep(100);
    }
    
    return embeddings;
  }
  
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Vector Storage (pgvector)

### HNSW Indexing

```sql
-- Create table for chunks with vectors
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  index_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create HNSW index for similarity search
CREATE INDEX idx_chunks_embedding ON chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Analyze statistics for query planner
ANALYZE chunks;
```

### Similarity Search Query

```sql
-- Find top 5 most similar chunks to query embedding
SELECT 
  id,
  content,
  embedding <=> $1 as distance,
  1 - (embedding <=> $1) as similarity
FROM chunks
WHERE index_id = $2
ORDER BY embedding <=> $1
LIMIT 5;

-- distance: Lower is more similar (0 = identical, 2 = opposite)
-- similarity: Higher is more similar (0 = opposite, 1 = identical)
```

## Incremental Ingestion

### Change Detection

```typescript
class IncrementalIngester {
  async ingest(dataSource: DataSource) {
    // Get last ingestion time
    const lastIngestTime = await this.getLastIngestTime(dataSource.id);
    
    // Fetch only changed documents
    const documents = await this.connector.discover({
      ...dataSource.config,
      since: lastIngestTime
    });
    
    // Process changes
    for (const doc of documents) {
      if (doc.modified_at > lastIngestTime) {
        // Fetch old chunks for deletion
        const oldChunks = await this.getChunksBySourceId(doc.source_id);
        
        // Delete old chunks
        for (const chunk of oldChunks) {
          await this.index.deleteChunk(chunk.id);
        }
        
        // Re-chunk and re-index
        const newChunks = await this.chunkifier.chunk(doc);
        await this.index.addChunks(newChunks);
      }
    }
    
    // Update last ingestion time
    await this.updateLastIngestTime(dataSource.id, new Date());
  }
}
```

## Error Handling & Recovery

### Failure Modes

```typescript
class IngestmentJobProcessor {
  async processJob(job: IngestionJob) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        await this.runIngestion(job);
        return;
      } catch (error) {
        attempt++;
        
        if (error instanceof RateLimitError) {
          // Wait and retry
          await this.sleep(exponentialBackoff(attempt));
          continue;
        } else if (error instanceof AuthenticationError) {
          // Mark as failed - credentials invalid
          await this.updateJobStatus(job.id, 'FAILED', error.message);
          return;
        } else if (error instanceof TransientError) {
          // Retry transient errors
          await this.sleep(exponentialBackoff(attempt));
          continue;
        } else {
          // Unknown error - mark failed
          await this.updateJobStatus(job.id, 'FAILED', error.message);
          return;
        }
      }
    }
    
    // All retries exhausted
    await this.updateJobStatus(job.id, 'FAILED', 'Max retries exceeded');
  }
}
```

---

**Last Updated**: March 24, 2026
