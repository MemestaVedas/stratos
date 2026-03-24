'use client';

import React, { useCallback } from 'react';
import { FileText, Play, Save, Download, Undo2, Copy } from 'lucide-react';

interface EditorProps {
  workflowId: string;
  workflowName: string;
  onSave: (data: any) => void;
  onRun: () => void;
}

export default function DAGEditor({ workflowId, workflowName, onSave, onRun }: EditorProps) {
  const handleSave = useCallback(() => {
    onSave({ message: 'Workflow saved successfully' });
  }, [onSave]);

  const handleRun = useCallback(() => {
    onRun();
  }, [onRun]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">{workflowName}</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{workflowId}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Play className="w-4 h-4" />
            Run
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex gap-4 p-4">
        {/* Node Palette */}
        <div className="w-48 bg-white rounded-lg border border-gray-200 p-4 overflow-y-auto shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Node Types</h3>
          <div className="space-y-2">
            {[
              { icon: '⚡', name: 'Trigger' },
              { icon: '🤖', name: 'LLM Call' },
              { icon: '{}', name: 'Code Executor' },
              { icon: '🌐', name: 'HTTP Request' },
              { icon: '⚙️', name: 'Data Transform' },
              { icon: '🔀', name: 'Conditional' },
              { icon: '👤', name: 'Human Approval' },
              { icon: '📦', name: 'Sub-Workflow' },
              { icon: '🔗', name: 'Aggregator' },
              { icon: '⏱️', name: 'Delay' },
            ].map((node) => (
              <div
                key={node.name}
                draggable
                className="p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded cursor-move transition text-sm font-medium text-gray-700"
              >
                <span className="mr-2">{node.icon}</span>
                {node.name}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">Canvas</p>
            <p className="text-sm">Drag nodes from the left palette to build your workflow</p>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="w-64 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Selected Node</label>
              <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">None</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Properties</label>
              <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded h-32 overflow-y-auto">
                Select a node to see properties
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center text-xs text-gray-600">
        <span>Workflow ID: {workflowId}</span>
        <span>Nodes: 0 | Edges: 0</span>
        <span>Last saved: just now</span>
      </div>
    </div>
  );
}
