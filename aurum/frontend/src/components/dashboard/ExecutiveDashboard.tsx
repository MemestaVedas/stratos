'use client';

import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, Users } from 'lucide-react';

export default function ExecutiveDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Intelligence Dashboard</h1>
        <p className="text-gray-600">Real-time insights into customer health and churn risk</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'ARR', value: '$2.5M', trend: '+12%', color: 'bg-blue-50 text-blue-900' },
          { label: 'NRR', value: '125.3%', trend: '+3.2%', color: 'bg-green-50 text-green-900' },
          { label: 'GRR', value: '95.2%', trend: '+1.8%', color: 'bg-purple-50 text-purple-900' },
          { label: 'Logo Churn', value: '3.2%', trend: '-0.5%', color: 'bg-red-50 text-red-900' },
          { label: 'At Risk', value: '42 accts', trend: '+5', color: 'bg-orange-50 text-orange-900' }
        ].map((kpi, idx) => (
          <div key={idx} className={`${kpi.color} rounded-lg p-6 border border-gray-200`}>
            <p className="text-sm font-medium opacity-75">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            <p className="text-xs mt-2">{kpi.trend} this month</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ARR Waterfall */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            ARR Movement
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Starting ARR', value: '$2.3M', color: 'bg-gray-300' },
              { label: 'New Business', value: '+$120K', color: 'bg-green-500' },
              { label: 'Expansion', value: '+$95K', color: 'bg-green-400' },
              { label: 'Churn', value: '-$85K', color: 'bg-red-500' },
              { label: 'Forecast ARR', value: '$2.5M', color: 'bg-blue-500' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <div className="flex items-center gap-3">
                  <div className={`${item.color} h-2 w-20 rounded`}></div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Health Distribution</h3>
          <div className="space-y-4">
            {[
              { label: 'Healthy', value: 65, color: 'bg-green-500' },
              { label: 'At Risk', value: 25, color: 'bg-yellow-500' },
              { label: 'High Risk', value: 10, color: 'bg-red-500' }
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Churn Risk Heatmap */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Top At-Risk Accounts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Account</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">ARR</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Churn Probability</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Days to Renewal</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Acme Corp', arr: '$500K', churn: '85%', days: '45' },
                  { name: 'TechCorp Inc', arr: '$350K', churn: '78%', days: '60' },
                  { name: 'DataFlow Systems', arr: '$280K', churn: '72%', days: '30' }
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 font-semibold">{row.arr}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                        {row.churn}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
