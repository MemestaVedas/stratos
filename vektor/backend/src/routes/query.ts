import { Router, Request, Response } from 'express';
import { QueryPipeline } from '../services/QueryPipeline';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/indexes/:indexId/query - Semantic search with RAG
router.post('/:indexId/query', async (req: Request, res: Response) => {
  try {
    const { query, k, rerank, include_metadata, stream, filters } = req.body;

    if (!query || query.length < 3) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'INVALID_QUERY', message: 'Query must be at least 3 characters' }
      });
    }

    if (stream) {
      // Streaming response via SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        // First, send search results
        const result = await QueryPipeline.execute({
          query, index_id: req.params.indexId, k, rerank, include_metadata, filters
        });

        res.write(`event: search_results\ndata: ${JSON.stringify({ chunks: result.search_results })}\n\n`);

        // Then stream the RAG response
        const words = result.rag_response.text.split(' ');
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join(' ');
          res.write(`event: rag_streaming\ndata: ${JSON.stringify({ text: chunk + ' ' })}\n\n`);
          await new Promise(r => setTimeout(r, 50));
        }

        res.write(`event: complete\ndata: ${JSON.stringify({
          query_id: result.query_id,
          confidence: result.rag_response.confidence,
          sources: result.rag_response.sources,
          latencies: result.latencies,
        })}\n\n`);
        res.end();
      } catch (err: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming response
    const result = await QueryPipeline.execute({
      query, index_id: req.params.indexId, k, rerank, include_metadata, filters
    });

    res.json({ status: 'success', data: result });
  } catch (error: any) {
    logger.error('Error processing query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// POST /api/indexes/:indexId/search - Simple vector search (no RAG)
router.post('/:indexId/search', async (req: Request, res: Response) => {
  try {
    const { query, k = 5, filters } = req.body;

    if (!query) return res.status(400).json({ error: 'Query is required' });

    const result = await QueryPipeline.execute({
      query, index_id: req.params.indexId, k, rerank: false
    });

    // Return only search results (no RAG synthesis)
    res.json({
      status: 'success',
      data: {
        query_id: result.query_id,
        results: result.search_results,
        latencies: {
          embedding_ms: result.latencies.embedding_ms,
          search_ms: result.latencies.search_ms,
        }
      }
    });
  } catch (error) {
    logger.error('Error processing search:', error);
    res.status(500).json({ error: 'Failed to process search' });
  }
});

export default router;
