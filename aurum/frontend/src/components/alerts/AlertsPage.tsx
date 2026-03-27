'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell, BellOff, Plus, Trash2, Play, Pause, BookOpen,
  Slack, Mail, Globe, ChevronDown, Settings
} from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  condition: { field: string; operator: string; value: number };
  severity: 'info' | 'warning' | 'critical';
  channels: { email?: boolean; slack_webhook?: string; in_app?: boolean };
  is_active: boolean;
  playbook_id?: string;
}

interface AlertEvent {
  id: string;
  rule_name: string;
  account_name: string;
  account_arr: number;
  severity: string;
  triggered_at: string;
  status: 'active' | 'snoozed' | 'resolved';
}

// Mock data
const MOCK_RULES: AlertRule[] = [
  { id: 'r1', name: 'Health Score Critical', condition: { field: 'health_score', operator: '<', value: 30 }, severity: 'critical', channels: { slack_webhook: '#revenue-alerts', email: true, in_app: true }, is_active: true },
  { id: 'r2', name: 'High Churn Probability', condition: { field: 'churn_probability', operator: '>', value: 0.7 }, severity: 'critical', channels: { email: true, in_app: true }, is_active: true },
  { id: 'r3', name: 'Login Dormancy (14d)', condition: { field: 'days_since_login', operator: '>', value: 14 }, severity: 'warning', channels: { in_app: true }, is_active: true },
  { id: 'r4', name: 'Payment Failure', condition: { field: 'payment_failures_90d', operator: '>', value: 0 }, severity: 'warning', channels: { email: true, slack_webhook: '#billing-alerts' }, is_active: false },
  { id: 'r5', name: 'Seat Utilization Drop', condition: { field: 'seat_utilization', operator: '<', value: 40 }, severity: 'info', channels: { in_app: true }, is_active: true },
];

const MOCK_EVENTS: AlertEvent[] = [
  { id: 'e1', rule_name: 'Health Score Critical', account_name: 'TechCorp Inc', account_arr: 150000, severity: 'critical', triggered_at: '2 hours ago', status: 'active' },
  { id: 'e2', rule_name: 'High Churn Probability', account_name: 'DataFlow Labs', account_arr: 85000, severity: 'critical', triggered_at: '6 hours ago', status: 'active' },
  { id: 'e3', rule_name: 'Login Dormancy (14d)', account_name: 'CloudSync Solutions', account_arr: 42000, severity: 'warning', triggered_at: '1 day ago', status: 'snoozed' },
  { id: 'e4', rule_name: 'Seat Utilization Drop', account_name: 'Apex Analytics', account_arr: 195000, severity: 'info', triggered_at: '2 days ago', status: 'active' },
  { id: 'e5', rule_name: 'Payment Failure', account_name: 'StartupXYZ', account_arr: 28000, severity: 'warning', triggered_at: '3 days ago', status: 'resolved' },
];

const PLAYBOOKS = [
  { id: 'pb1', name: 'High Churn Risk Playbook', steps: 5 },
  { id: 'pb2', name: 'Expansion Opportunity Playbook', steps: 4 },
  { id: 'pb3', name: 'Payment Recovery Playbook', steps: 3 },
  { id: 'pb4', name: 'Renewal Preparation Playbook', steps: 6 },
];

export default function AlertsPage() {
  const [view, setView] = useState<'events' | 'rules' | 'playbooks'>('events');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [rules, setRules] = useState<AlertRule[]>(MOCK_RULES);
  const [events] = useState<AlertEvent[]>(MOCK_EVENTS);

  const filteredEvents = eventFilter === 'all' ? events :
    events.filter(e => e.status === eventFilter);

  const severityStyle = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-800' :
    s === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';

  const statusStyle = (s: string) =>
    s === 'active' ? 'bg-red-50 text-red-700 border-red-200' :
    s === 'snoozed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-green-50 text-green-700 border-green-200';

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Alerts & Playbooks</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor alerts, manage rules, and automate response playbooks</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Alert Rule
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {(['events', 'rules', 'playbooks'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'events' ? `Events (${events.filter(e => e.status === 'active').length})` :
               tab === 'rules' ? `Rules (${rules.length})` : `Playbooks (${PLAYBOOKS.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {view === 'events' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              {['all', 'active', 'snoozed', 'resolved'].map(f => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition ${
                    eventFilter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >{f}</button>
              ))}
            </div>

            {filteredEvents.map(event => (
              <div key={event.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition">
                <div className={`px-2 py-1 rounded text-xs font-medium ${severityStyle(event.severity)}`}>
                  {event.severity}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{event.rule_name}</p>
                  <p className="text-sm text-gray-500">{event.account_name} · ${(event.account_arr / 1000).toFixed(0)}K ARR · {event.triggered_at}</p>
                </div>
                <div className={`px-2.5 py-1 rounded border text-xs font-medium ${statusStyle(event.status)}`}>
                  {event.status}
                </div>
                {event.status === 'active' && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded text-xs hover:bg-amber-100">Snooze</button>
                    <button className="px-3 py-1.5 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100">Resolve</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {view === 'rules' && (
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
                <button
                  onClick={() => setRules(rs => rs.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))}
                  className={`p-2 rounded-lg transition ${rule.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                >
                  {rule.is_active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {rule.condition.field} {rule.condition.operator} {rule.condition.value}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${severityStyle(rule.severity)}`}>
                  {rule.severity}
                </div>
                <div className="flex gap-1.5 text-gray-400">
                  {rule.channels.email && <Mail className="w-4 h-4" title="Email" />}
                  {rule.channels.slack_webhook && <Slack className="w-4 h-4" title="Slack" />}
                  {rule.channels.in_app && <Globe className="w-4 h-4" title="In-app" />}
                </div>
                <button className="p-1.5 text-gray-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'playbooks' && (
          <div className="grid grid-cols-2 gap-4">
            {PLAYBOOKS.map(pb => (
              <div key={pb.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">{pb.name}</h3>
                </div>
                <p className="text-sm text-gray-500">{pb.steps} automated steps</p>
                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100">View Steps</button>
                  <button className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded text-xs hover:bg-gray-100">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
