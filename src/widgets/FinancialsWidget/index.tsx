import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { marketService } from '../../services/marketService';
import type { MarketDataset } from '../../types';

type Props = { ticker: string };

export default function FinancialsWidget({ ticker }: Props) {
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketService.getDataset(ticker).then((ds) => {
      if (active) setDataset(ds);
    }).catch((err) => { if (active) setError(err.message || 'Error loading data'); });
    return () => { active = false; };
  }, [ticker]);

  const fin = dataset?.financials;

  // For forex: revenue = GDP growth %, eps = interest rates %
  const gdpData = useMemo(
    () =>
      fin?.revenue.map((val, i) => ({
        quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
        gdp: val,
      })) ?? [],
    [fin?.revenue]
  );

  const rateData = useMemo(
    () =>
      fin?.eps.map((val, i) => ({
        quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
        rate: val,
      })) ?? [],
    [fin?.eps]
  );

  // Extract base/quote from pair like "EUR/USD"
  const [base] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];

  const gdpOption = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: 22, left: 33 },
    xAxis: {
      type: 'category',
      data: gdpData.map((d) => d.quarter),
      axisLabel: { fontSize: 8, color: '#64748b' },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 8, color: '#64748b', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderRadius: 6,
      textStyle: { fontSize: 10, color: '#e2e8f0' },
      formatter: (params: any[]) => {
        const p = params[0];
        return `${p.name}<br/>GDP Growth: ${p.value}%`;
      },
    },
    series: [
      {
        type: 'bar',
        data: gdpData.map((d) => d.gdp),
        itemStyle: { color: '#3b82f6', borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  }), [gdpData]);

  const rateOption = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: 22, left: 33 },
    xAxis: {
      type: 'category',
      data: rateData.map((d) => d.quarter),
      axisLabel: { fontSize: 8, color: '#64748b' },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 8, color: '#64748b', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderRadius: 6,
      textStyle: { fontSize: 10, color: '#e2e8f0' },
      formatter: (params: any[]) => {
        const p = params[0];
        return `${p.name}<br/>Rate: ${p.value}%`;
      },
    },
    series: [
      {
        type: 'bar',
        data: rateData.map((d) => d.rate),
        itemStyle: { color: '#10b981', borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  }), [rateData]);

  return (
    <div className="flex flex-col h-full gap-3">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-400">{error}</span>
          </div>
        </div>
      )}
      {(!dataset || !fin) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10 backdrop-blur-sm rounded-lg">
          <span className="text-xs text-gray-400">Loading financials...</span>
        </div>
      )}
      {/* Key macro metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Debt-to-GDP" value={`${fin?.debt ?? 0}%`} positive={(fin?.debt ?? 0) < 60} />
        <MetricCard label="CPI (Inflation)" value={`${fin?.margins ?? 0}%`} positive={(fin?.margins ?? 0) > 0 && (fin?.margins ?? 0) < 3} />
        <MetricCard label="Unemployment" value={`${fin?.peRatio ?? 0}%`} positive={(fin?.peRatio ?? 0) < 5} />
        <MetricCard label="Trade Balance" value={`${(fin?.pegRatio ?? 0) > 0 ? '+' : ''}${fin?.pegRatio ?? 0}B`} positive={(fin?.pegRatio ?? 0) > 0} />
      </div>

      <div className="flex-1 min-h-[200px] flex flex-col gap-2">
        <div className="shrink-0">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            {base} GDP Growth (%)
          </div>
          <ReactECharts option={gdpOption} style={{ height: 80, width: '100%' }} notMerge />
        </div>

        <div className="shrink-0">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            {base} Interest Rate (%)
          </div>
          <ReactECharts option={rateOption} style={{ height: 80, width: '100%' }} notMerge />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
