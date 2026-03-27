'use client';

import React, { useState, useEffect } from 'react';
import {
  Heart, TrendingDown, TrendingUp, AlertTriangle, DollarSign,
  Activity, Users, Clock, MessageSquare, Shield, ChevronRight,
  RefreshCw, FileText, Phone, Mail
} from 'lucide-react';

interface Account360Props {
  accountId: string;
}

// Mock data generator for demonstration
function generateMockAccountData(accountId: string) {
  return {
    id: accountId,
    name: 'TechCorp Inc',
    arr: 150000,
    mrr: 12500,
    plan: 'Enterprise',
    health_score: 42,
    churn_probability: 0.72,
    churn_risk_tier: 'high_risk',
    contract_end: '2026-06-15',
    owner: 'Sarah Chen',
    industry: 'SaaS',
    employee_count: 250,
    metrics: {
      dau_7d: 12,
      mau_30d: 45,
      sessions_7d: 28,
      seat_utilization: 48,
      active_seats: 12,
      licensed_seats: 25,
      support_tickets_30d: 8,
      avg_csat_90d: 3.2,
      days_since_login: 5,
      payment_failures_90d: 2,
      days_to_renewal: 87,
    },
    health_score_breakdown: {
      total: 42,
      engagement: 38,
      utilization: 48,
      support: 40,
      financial: 45,
      relationship: 55,
    },
    shap_factors: [
      { feature: 'Seat Utilization Drop', direction: 'negative', contribution: 0.35, value: '48%', threshold: '60%' },
      { feature: 'Payment Failures', direction: 'negative', contribution: 0.28, value: '2', threshold: '0' },
      { feature: 'Low DAU/MAU Ratio', direction: 'negative', contribution: 0.18, value: '0.15', threshold: '0.30' },
      { feature: 'Support Ticket Volume', direction: 'negative', contribution: 0.12, value: '8/mo', threshold: '5/mo' },
      { feature: 'Feature Adoption', direction: 'positive', contribution: -0.10, value: '72%', threshold: '50%' },
    ],
    recommendations: [
      'Schedule an Executive Business Review (EBR)',
      'Address payment failures with billing team',
      'Review seat optimization — 12 of 25 seats active',
      'Escalate to Account Executive — high churn risk',
    ],
    timeline: [
      { type: 'alert', title: 'Health Score dropped below 50', time: '2 hours ago', severity: 'critical' },
      { type: 'support', title: '3 new support tickets created', time: '1 day ago', severity: 'warning' },
      { type: 'billing', title: 'Payment failed — invoice #INV-1234', time: '3 days ago', severity: 'critical' },
      { type: 'usage', title: 'Feature "advanced_export" used by 4 users', time: '5 days ago', severity: 'info' },
      { type: 'cs_touchpoint', title: 'QBR meeting completed', time: '2 weeks ago', severity: 'info' },
    ],
    health_history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      score: Math.max(25, Math.min(85, 65 - i * 0.8 + Math.random() * 5)),
    })),
  };
}

export default function Account360({ accountId }: Account360Props) {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'support' | 'financial'>('overview');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    setData(generateMockAccountData(accountId));
    setAiSummary(
      'TechCorp Inc shows declining health with a score of 42/100. The account has high churn risk (72% probability) ' +
      'driven primarily by a seat utilization drop from 85% to 48% over the last 60 days, combined with 2 payment failures. ' +
      'Recommended action: Schedule an EBR with executive sponsor and address billing configuration issues.'
    );
  }, [accountId]);

  if (!data) return <div className="p-8 text-gray-500">Loading...</div>;

  const riskColor = data.churn_risk_tier === 'high_risk' ? 'red' :
                    data.churn_risk_tier === 'at_risk' ? 'amber' : 'green';

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>{data.plan} Plan</span>
              <span>•</span>
              <span>{data.industry}</span>
              <span>•</span>
              <span>{data.employee_count} employees</span>
              <span>•</span>
              <span>CSM: {data.owner}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
              <Phone className="w-4 h-4" /> Schedule Call
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
              <Mail className="w-4 h-4" /> Send Email
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-xs text-gray-500 uppercase">ARR</div>
            <div className="text-xl font-bold mt-1">${(data.arr / 1000).toFixed(0)}K</div>
          </div>
          <div className={`rounded-lg p-4 border ${riskColor === 'red' ? 'bg-red-50 border-red-200' : riskColor === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="text-xs text-gray-500 uppercase">Health Score</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold">{data.health_score}</span>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="text-xs text-gray-500 uppercase">Churn Risk</div>
            <div className="text-xl font-bold text-red-600 mt-1">{Math.round(data.churn_probability * 100)}%</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-xs text-gray-500 uppercase">Renewal</div>
            <div className="text-xl font-bold mt-1">{data.metrics.days_to_renewal}d</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-xs text-gray-500 uppercase">Seats</div>
            <div className="text-xl font-bold mt-1">{data.metrics.active_seats}/{data.metrics.licensed_seats}</div>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="col-span-2 space-y-6">
          {/* AI Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> AI Account Summary
              </h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
          </div>

          {/* SHAP Explanations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Why is this account at risk?
            </h3>
            <div className="space-y-3">
              {data.shap_factors.map((factor: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-48 text-sm font-medium text-gray-700">{factor.feature}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${factor.direction === 'positive' ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.abs(factor.contribution) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-xs text-gray-500 text-right">
                    {factor.value} / {factor.threshold}
                  </div>
                  <div className="w-16 text-xs font-mono text-right">
                    {factor.direction === 'positive' ?
                      <span className="text-green-600">-{(factor.contribution * 100).toFixed(0)}%</span> :
                      <span className="text-red-600">+{(factor.contribution * 100).toFixed(0)}%</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Score History */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" /> Health Score - 30 Day Trend
            </h3>
            <div className="h-32 flex items-end gap-0.5">
              {data.health_history.map((point: any, idx: number) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-t transition-all ${
                    point.score >= 75 ? 'bg-green-400' :
                    point.score >= 50 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ height: `${point.score}%` }}
                  title={`${point.date}: ${Math.round(point.score)}`}
                />
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" /> Activity Timeline
            </h3>
            <div className="space-y-4">
              {data.timeline.map((event: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    event.severity === 'critical' ? 'bg-red-500' :
                    event.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500">{event.time} · {event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Next Best Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" /> Recommended Actions
            </h3>
            <div className="space-y-3">
              {data.recommendations.map((action: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                  <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-900">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(data.health_score_breakdown).filter(([k]) => k !== 'total').map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-gray-500 capitalize">{key}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (value as number) >= 70 ? 'bg-green-500' :
                        (value as number) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-right font-mono">{value as number}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Usage Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">DAU (7d)</span>
                <p className="font-semibold">{data.metrics.dau_7d}</p>
              </div>
              <div>
                <span className="text-gray-500">MAU (30d)</span>
                <p className="font-semibold">{data.metrics.mau_30d}</p>
              </div>
              <div>
                <span className="text-gray-500">Sessions/wk</span>
                <p className="font-semibold">{data.metrics.sessions_7d}</p>
              </div>
              <div>
                <span className="text-gray-500">CSAT</span>
                <p className="font-semibold">{data.metrics.avg_csat_90d}/5.0</p>
              </div>
              <div>
                <span className="text-gray-500">Tickets (30d)</span>
                <p className="font-semibold text-amber-600">{data.metrics.support_tickets_30d}</p>
              </div>
              <div>
                <span className="text-gray-500">Pay Failures</span>
                <p className="font-semibold text-red-600">{data.metrics.payment_failures_90d}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
