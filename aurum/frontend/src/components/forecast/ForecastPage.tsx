'use client';

import React, { useState } from 'react';
import { TrendingUp, DollarSign, BarChart3, Shield, Sliders } from 'lucide-react';

function generateForecastData(months: number, baseArr: number) {
  const data = [];
  let current = baseArr;
  for (let i = 0; i < months; i++) {
    const month = new Date();
    month.setMonth(month.getMonth() + i);
    const growth = current * (0.02 + Math.random() * 0.03);
    const churn = current * (0.01 + Math.random() * 0.015);
    current += growth - churn;
    data.push({
      month: month.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      arr: Math.round(current),
      lower: Math.round(current * (0.95 - i * 0.008)),
      upper: Math.round(current * (1.05 + i * 0.008)),
    });
  }
  return data;
}

export default function ForecastPage() {
  const baseArr = 2500000;
  const [months, setMonths] = useState(12);
  const [saveRate, setSaveRate] = useState(50);
  const forecast = generateForecastData(months, baseArr);
  const maxArr = Math.max(...forecast.map(f => f.upper));
  const minArr = Math.min(...forecast.map(f => f.lower));

  const atRiskArr = 450000;
  const savedArr = Math.round(atRiskArr * (saveRate / 100));

  // Waterfall data
  const waterfall = [
    { label: 'Current ARR', value: baseArr, color: 'bg-blue-500' },
    { label: 'New Business', value: Math.round(baseArr * 0.05), color: 'bg-green-500' },
    { label: 'Expansion', value: Math.round(baseArr * 0.06), color: 'bg-emerald-500' },
    { label: 'Contraction', value: -Math.round(baseArr * 0.02), color: 'bg-amber-500' },
    { label: 'Churn', value: -Math.round(atRiskArr * (1 - saveRate / 100)), color: 'bg-red-500' },
    { label: 'Forecasted ARR', value: 0, color: 'bg-blue-600' },
  ];
  waterfall[waterfall.length - 1].value = waterfall.reduce((s, w) => s + w.value, 0);

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600" /> Revenue Forecast
        </h1>
        <p className="text-sm text-gray-500 mt-1">ARR forecasting with scenario modeling and confidence intervals</p>
      </div>

      <div className="p-8 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-500 uppercase">Current ARR</p>
            <p className="text-2xl font-bold mt-1">${(baseArr / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-500 uppercase">Forecasted ARR ({months}mo)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              ${(forecast[forecast.length - 1].arr / 1000000).toFixed(2)}M
            </p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-500 uppercase">At-Risk ARR</p>
            <p className="text-2xl font-bold text-red-600 mt-1">${(atRiskArr / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-xs text-gray-500 uppercase">Save Rate Impact</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">+${(savedArr / 1000).toFixed(0)}K</p>
          </div>
        </div>

        {/* Forecast Chart */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">ARR Forecast with Confidence Intervals</h3>
            <select
              value={months}
              onChange={e => setMonths(parseInt(e.target.value))}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={18}>18 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>
          <div className="h-64 flex items-end gap-1">
            {forecast.map((point, idx) => {
              const range = maxArr - minArr;
              const barHeight = ((point.arr - minArr) / range) * 100;
              const lowerHeight = ((point.lower - minArr) / range) * 100;
              const upperHeight = ((point.upper - minArr) / range) * 100;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center group relative">
                  {/* Confidence interval */}
                  <div
                    className="w-full bg-blue-100 rounded-t absolute bottom-0"
                    style={{ height: `${upperHeight}%` }}
                  />
                  <div
                    className="w-full bg-white absolute bottom-0"
                    style={{ height: `${lowerHeight}%` }}
                  />
                  {/* Actual bar */}
                  <div
                    className="w-3/4 bg-blue-500 rounded-t relative z-10"
                    style={{ height: `${barHeight}%`, marginTop: 'auto' }}
                  />
                  <span className="text-[9px] text-gray-400 mt-1">{point.month}</span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-20 whitespace-nowrap">
                    ${(point.arr / 1000000).toFixed(2)}M ({(point.lower / 1000000).toFixed(2)}-{(point.upper / 1000000).toFixed(2)})
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Scenario Modeling */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" /> Scenario Modeling
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">At-Risk Account Save Rate</span>
                  <span className="font-medium">{saveRate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={saveRate}
                  onChange={e => setSaveRate(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>No saves</span>
                  <span>Save all</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mt-4 space-y-2">
                <p className="text-sm"><span className="text-gray-500">Accounts at risk:</span> <span className="font-semibold">12</span></p>
                <p className="text-sm"><span className="text-gray-500">ARR at risk:</span> <span className="font-semibold text-red-600">${(atRiskArr / 1000).toFixed(0)}K</span></p>
                <p className="text-sm"><span className="text-gray-500">Expected saves:</span> <span className="font-semibold text-green-600">{Math.round(12 * saveRate / 100)} accounts (${(savedArr / 1000).toFixed(0)}K)</span></p>
                <p className="text-sm"><span className="text-gray-500">Expected churn loss:</span> <span className="font-semibold text-red-600">${((atRiskArr - savedArr) / 1000).toFixed(0)}K</span></p>
              </div>
            </div>
          </div>

          {/* ARR Waterfall */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" /> ARR Waterfall
            </h3>
            <div className="space-y-3">
              {waterfall.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full ${item.color}`}
                      style={{ width: `${Math.abs(item.value) / maxArr * 100}%` }}
                    />
                  </div>
                  <span className={`w-20 text-right text-sm font-mono ${item.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.value < 0 ? '-' : ''}${(Math.abs(item.value) / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
