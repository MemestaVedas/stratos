'use client';

import React, { useState, useEffect } from 'react';
import {
  Play, Square, RefreshCw, Clock, CheckCircle, XCircle,
  Timer, Zap, DollarSign, BarChart3, ChevronDown, Eye
} from 'lucide-react';

interface Execution {
  id: string;
  workflow_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_source: string;
  started_at: string;
  duration_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  node_count: number;
}

interface ExecutionMetrics {
  total: number;
  completed: number;
  failed: number;
  running: number;
  success_rate: number;
  avg_duration_ms: number;
  total_cost_usd: number;
}

const MOCK_EXECUTIONS: Execution[] = [
  { id: 'exec_001', workflow_name: 'Process Orders', status: 'running', trigger_source: 'webhook', started_at: '2 min ago', duration_ms: 0, total_tokens: 245, total_cost_usd: 0.003, node_count: 5 },
  { id: 'exec_002', workflow_name: 'Email Classification', status: 'completed', trigger_source: 'schedule', started_at: '15 min ago', duration_ms: 3420, total_tokens: 1820, total_cost_usd: 0.024, node_count: 8 },
  { id: 'exec_003', workflow_name: 'Lead Enrichment', status: 'completed', trigger_source: 'api', started_at: '32 min ago', duration_ms: 5100, total_tokens: 3200, total_cost_usd: 0.042, node_count: 12 },
  { id: 'exec_004', workflow_name: 'Support Ticket Router', status: 'failed', trigger_source: 'webhook', started_at: '1 hour ago', duration_ms: 1200, total_tokens: 450, total_cost_usd: 0.006, node_count: 6 },
  { id: 'exec_005', workflow_name: 'Data Sync Pipeline', status: 'completed', trigger_source: 'schedule', started_at: '2 hours ago', duration_ms: 8500, total_tokens: 0, total_cost_usd: 0, node_count: 4 },
  { id: 'exec_006', workflow_name: 'Process Orders', status: 'completed', trigger_source: 'webhook', started_at: '3 hours ago', duration_ms: 2800, total_tokens: 1200, total_cost_usd: 0.016, node_count: 5 },
  { id: 'exec_007', workflow_name: 'Email Classification', status: 'cancelled', trigger_source: 'manual', started_at: '4 hours ago', duration_ms: 600, total_tokens: 200, total_cost_usd: 0.003, node_count: 3 },
];

const MOCK_METRICS: ExecutionMetrics = {
  total: 1247, completed: 1180, failed: 42, running: 3,
  success_rate: 94.6, avg_duration_ms: 3200, total_cost_usd: 28.45,
};

export default function ExecutionDashboard() {
  const [filter, setFilter] = useState<string>('all');
  const [executions] = useState<Execution[]>(MOCK_EXECUTIONS);
  const [metrics] = useState<ExecutionMetrics>(MOCK_METRICS);

  const filtered = filter === 'all' ? executions :
    executions.filter(e => e.status === filter);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'running': return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <Square className="w-4 h-4 text-gray-400" />;
      case 'queued': return <Clock className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-green-700 bg-green-50' :
    s === 'running' ? 'text-blue-700 bg-blue-50' :
    s === 'failed' ? 'text-red-700 bg-red-50' :
    s === 'cancelled' ? 'text-gray-600 bg-gray-50' :
    'text-amber-700 bg-amber-50';

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" /> Execution Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">Monitor workflow execution in real-time</p>
          </div>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 border">
            <p className="text-xs text-gray-500 uppercase">Total Executions</p>
            <p className="text-2xl font-bold mt-1">{metrics.total.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-xs text-gray-500 uppercase">Success Rate</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{metrics.success_rate}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border">
            <p className="text-xs text-gray-500 uppercase">Avg Duration</p>
            <p className="text-2xl font-bold mt-1">{(metrics.avg_duration_ms / 1000).toFixed(1)}s</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-xs text-gray-500 uppercase">Running Now</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.running}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border">
            <p className="text-xs text-gray-500 uppercase">Total Cost</p>
            <p className="text-2xl font-bold mt-1">${metrics.total_cost_usd.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {['all', 'running', 'completed', 'failed', 'cancelled', 'queued'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition ${
                filter === f ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >{f}{f === 'all' ? ` (${executions.length})` : ` (${executions.filter(e => e.status === f).length})`}</button>
          ))}
        </div>

        {/* Execution List */}
        <div className="space-y-2">
          {filtered.map(exec => (
            <div key={exec.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition cursor-pointer">
              {statusIcon(exec.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{exec.workflow_name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(exec.status)}`}>
                    {exec.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="font-mono">{exec.id}</span>
                  <span>•</span>
                  <span>{exec.trigger_source}</span>
                  <span>•</span>
                  <span>{exec.started_at}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Duration</p>
                  <p className="font-mono">{exec.duration_ms > 0 ? `${(exec.duration_ms / 1000).toFixed(1)}s` : '...'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Nodes</p>
                  <p className="font-mono">{exec.node_count}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Tokens</p>
                  <p className="font-mono">{exec.total_tokens > 0 ? exec.total_tokens.toLocaleString() : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Cost</p>
                  <p className="font-mono">{exec.total_cost_usd > 0 ? `$${exec.total_cost_usd.toFixed(3)}` : '—'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-gray-400 hover:text-blue-600 transition">
                  <Eye className="w-4 h-4" />
                </button>
                {exec.status === 'running' && (
                  <button className="p-2 text-gray-400 hover:text-red-600 transition">
                    <Square className="w-4 h-4" />
                  </button>
                )}
                {(exec.status === 'completed' || exec.status === 'failed') && (
                  <button className="p-2 text-gray-400 hover:text-green-600 transition">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
