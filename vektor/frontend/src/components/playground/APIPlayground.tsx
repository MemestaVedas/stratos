'use client';

import React, { useState } from 'react';
import { Send, BookOpen, ChevronRight, Loader2, Sparkles, Clock, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';

interface SearchResult {
  chunk_id: string;
  content: string;
  relevance_score: number;
  source_type: string;
  metadata?: Record<string, any>;
}

interface QueryResult {
  query_id: string;
  query_text: string;
  answer: string;
  sources: SearchResult[];
  confidence: number;
  latencies: {
    embedding_ms: number;
    search_ms: number;
    rerank_ms: number;
    llm_ms: number;
    total_ms: number;
  };
}

const EXAMPLE_QUERIES = [
  'How do I set up the development environment?',
  'What are the API authentication options?',
  'Explain the database migration process',
  'How does the webhook integration work?',
];

export default function APIPlayground() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState('idx_docs_main');
  const [useReranking, setUseReranking] = useState(true);
  const [topK, setTopK] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  const handleQuery = async () => {
    if (!query.trim()) return;
    setIsLoading(true);

    // Simulate API call
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const mockSources: SearchResult[] = Array.from({ length: topK }, (_, i) => ({
      chunk_id: `chunk_${i + 1}`,
      content: `Relevant documentation excerpt ${i + 1}. This section covers the topic you asked about, providing detailed instructions and examples for implementation.`,
      relevance_score: Math.round((0.95 - i * 0.06 + Math.random() * 0.03) * 1000) / 1000,
      source_type: ['github', 'confluence', 'web', 'slack', 'notion'][i % 5],
      metadata: {
        file_path: ['docs/SETUP.md', 'docs/API.md', 'docs/architecture.md', 'README.md', 'CONTRIBUTING.md'][i % 5],
        chunk_number: i + 1,
      },
    }));

    setResult({
      query_id: 'query_' + Date.now(),
      query_text: query,
      answer: `Based on the available documentation, here's the answer to your question about "${query}":\n\n` +
        `The system provides comprehensive support for this functionality. Here are the key points:\n\n` +
        `1. **Configuration**: Set up the required environment variables in your .env file\n` +
        `2. **Installation**: Run \`npm install\` to install all dependencies\n` +
        `3. **Setup**: Follow the initialization steps in the setup guide\n` +
        `4. **Verification**: Run the test suite to confirm everything works\n\n` +
        `For more details, refer to the linked source documents below.`,
      sources: mockSources,
      confidence: Math.round((0.85 + Math.random() * 0.1) * 100) / 100,
      latencies: {
        embedding_ms: Math.round(30 + Math.random() * 50),
        search_ms: Math.round(80 + Math.random() * 120),
        rerank_ms: useReranking ? Math.round(150 + Math.random() * 100) : 0,
        llm_ms: Math.round(800 + Math.random() * 600),
        total_ms: Math.round(1100 + Math.random() * 800),
      },
    });

    setIsLoading(false);
  };

  const sourceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      github: 'bg-gray-800 text-white',
      confluence: 'bg-blue-600 text-white',
      slack: 'bg-purple-600 text-white',
      web: 'bg-green-600 text-white',
      notion: 'bg-gray-700 text-white',
    };
    return colors[type] || 'bg-gray-500 text-white';
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" /> API Playground
            </h1>
            <p className="text-sm text-gray-500 mt-1">Test semantic search and RAG queries against your indexes</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedIndex}
              onChange={e => setSelectedIndex(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="idx_docs_main">Documentation Index</option>
              <option value="idx_support">Support Knowledge Base</option>
              <option value="idx_codebase">Codebase Index</option>
            </select>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
            >
              Settings
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border flex gap-6">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Top-K Results</label>
              <input type="number" value={topK} onChange={e => setTopK(parseInt(e.target.value) || 5)}
                className="px-2 py-1 border rounded text-sm w-20" min={1} max={20} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={useReranking} onChange={e => setUseReranking(e.target.checked)}
                className="rounded" id="rerank" />
              <label htmlFor="rerank" className="text-sm text-gray-600">Enable Reranking</label>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 max-w-5xl mx-auto">
        {/* Query Input */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuery()}
              placeholder="Ask a question about your documents..."
              className="flex-1 px-4 py-3 text-lg border-0 focus:outline-none"
            />
            <button
              onClick={handleQuery}
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Query
            </button>
          </div>

          {!result && !isLoading && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-400 mb-2">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((q, i) => (
                  <button key={i} onClick={() => { setQuery(q); }}
                    className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs hover:bg-gray-100 transition">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* RAG Answer */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> AI Answer
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {result.latencies.total_ms}ms</span>
                  <span>Confidence: {Math.round(result.confidence * 100)}%</span>
                </div>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.answer}</div>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button className="p-2 text-gray-400 hover:text-green-600 transition"><ThumbsUp className="w-4 h-4" /></button>
                <button className="p-2 text-gray-400 hover:text-red-600 transition"><ThumbsDown className="w-4 h-4" /></button>
                <button className="p-2 text-gray-400 hover:text-blue-600 transition ml-auto"><Copy className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Latency Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">Pipeline Latency</h4>
              <div className="flex gap-2 h-6">
                {[
                  { label: 'Embed', value: result.latencies.embedding_ms, color: 'bg-blue-400' },
                  { label: 'Search', value: result.latencies.search_ms, color: 'bg-green-400' },
                  ...(result.latencies.rerank_ms > 0 ? [{ label: 'Rerank', value: result.latencies.rerank_ms, color: 'bg-amber-400' }] : []),
                  { label: 'LLM', value: result.latencies.llm_ms, color: 'bg-purple-400' },
                ].map((stage, i) => (
                  <div key={i} className="relative group"
                    style={{ flex: stage.value / result.latencies.total_ms }}>
                    <div className={`h-full ${stage.color} rounded`} />
                    <div className="absolute -bottom-6 left-0 text-[10px] text-gray-500">
                      {stage.label} ({stage.value}ms)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Source Chunks */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" /> Source Chunks ({result.sources.length})
              </h3>
              <div className="space-y-3">
                {result.sources.map((source, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceTypeColor(source.source_type)}`}>
                        {source.source_type}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{source.metadata?.file_path}</span>
                      <span className="ml-auto text-xs text-gray-400">Score: {source.relevance_score}</span>
                    </div>
                    <p className="text-sm text-gray-600">{source.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
