import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { marketService } from '../../services/marketService';
import type { MarketDataset } from '../../types';

type Props = { ticker: string };

// Map currency to a pair where it's the base (for fetching that currency's rates)
const CURRENCY_BASE_PAIR: Record<string, string> = {
  USD: 'USD/JPY',
  EUR: 'EUR/USD',
  GBP: 'GBP/USD',
  AUD: 'AUD/USD',
  NZD: 'NZD/USD',
  // CHF, CAD, JPY: no pair has these as base in our forex list
};

function getPairForCurrency(currency: string): string | null {
  return CURRENCY_BASE_PAIR[currency] ?? null;
}

export default function InterestRatesWidget({ ticker }: Props) {
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

  const [base, quote] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];
  const isPair = base && quote;

  // Base currency rates (from pair's dataset - base is always first in XXX/YYY)
  const baseRates = fin?.eps ?? [];
  const baseCurrent = baseRates[baseRates.length - 1] ?? 0;

  // Quote currency rates - fetch from a pair where quote is base, if available
  const quotePair = getPairForCurrency(quote);
  const [quoteDataset, setQuoteDataset] = useState<MarketDataset | null>(null);

  useEffect(() => {
    if (!quotePair) return;
    let active = true;
    marketService.getDataset(quotePair).then((ds) => {
      if (active) setQuoteDataset(ds);
    });
    return () => { active = false; };
  }, [quotePair]);

  const quoteRates = quoteDataset?.financials.eps ?? [];
  const quoteCurrent = quoteRates[quoteRates.length - 1] ?? baseRates[baseRates.length - 2] ?? 0;

  const rateDiff = isPair ? +(baseCurrent - quoteCurrent).toFixed(2) : 0;

  const chartData = useMemo(() => {
    const len = Math.max(baseRates.length, quoteRates.length);
    return Array.from({ length: len }, (_, i) => ({
      quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
      base: baseRates[i] ?? null,
      quote: quoteRates[i] ?? null,
    }));
  }, [baseRates, quoteRates]);

  const hasQuoteData = quoteRates.length > 0;

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: hasQuoteData ? 40 : 22, left: 35 },
    xAxis: {
      type: 'category',
      data: chartData.map((d) => d.quarter),
      boundaryGap: false,
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
    legend: hasQuoteData
      ? {
        bottom: 0,
        textStyle: { fontSize: 9, color: '#94a3b8' },
        itemWidth: 12,
        itemHeight: 4,
      }
      : { show: false },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderRadius: 6,
      textStyle: { fontSize: 10, color: '#e2e8f0' },
      formatter: (params: any[]) =>
        params.map((p) =>
          `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value != null ? `${p.value}%` : '--'}`
        ).join('<br/>'),
    },
    series: [
      {
        name: base,
        type: 'line',
        data: chartData.map((d) => d.base),
        smooth: true,
        connectNulls: true,
        lineStyle: { color: '#22d3ee', width: 2 },
        itemStyle: { color: '#22d3ee' },
        symbolSize: 4,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: 0 }],
          lineStyle: { color: '#475569', type: 'dashed', width: 1 },
          label: { show: false },
        },
      },
      ...(hasQuoteData
        ? [
          {
            name: quote,
            type: 'line',
            data: chartData.map((d) => d.quote),
            smooth: true,
            connectNulls: true,
            lineStyle: { color: '#f59e0b', width: 2 },
            itemStyle: { color: '#f59e0b' },
            symbolSize: 4,
          },
        ]
        : []),
    ],
  }), [chartData, hasQuoteData, base, quote]);

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
      {(!dataset) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10 backdrop-blur-sm rounded-lg">
          <span className="text-xs text-gray-400">Loading rates...</span>
        </div>
      )}
      {/* Current rates summary */}
      <div className={`grid gap-2 ${isPair ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{base} Rate</div>
          <div className="text-lg font-bold font-mono text-cyan-400">{baseCurrent}%</div>
        </div>
        {isPair && (
          <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border border-gray-700/30">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{quote} Rate</div>
            <div className="text-lg font-bold font-mono text-amber-400">{quoteCurrent}%</div>
          </div>
        )}
      </div>

      {/* Rate differential (carry) - only for pairs */}
      {isPair && (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Carry (Rate Diff)</span>
            <span
              className={`text-sm font-bold font-mono px-2 py-1 rounded ${rateDiff > 0
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : rateDiff < 0
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-gray-700/50 text-gray-400'
                }`}
            >
              {rateDiff > 0 ? '+' : ''}{rateDiff}%
            </span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {rateDiff > 0 ? `Favors ${base}` : rateDiff < 0 ? `Favors ${quote}` : 'Neutral'}
          </div>
        </div>
      )}

      {/* Historical rates chart */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          Interest Rate History (%)
        </div>
        <ReactECharts option={option} style={{ height: 120, width: '100%' }} notMerge />
      </div>
    </div>
  );
}
