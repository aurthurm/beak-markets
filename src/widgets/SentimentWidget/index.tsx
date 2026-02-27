import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';
import type { MarketDataset } from '../../types';

type Props = { ticker: string };

const DIRECTION_STYLES = {
  bullish: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', bar: 'bg-emerald-500' },
  bearish: { text: 'text-red-400', bg: 'bg-red-500/15', bar: 'bg-red-500' },
  neutral: { text: 'text-gray-400', bg: 'bg-gray-500/15', bar: 'bg-gray-500' },
};

export default function SentimentWidget({ ticker }: Props) {
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketService.getDataset(ticker).then((ds) => {
      if (active) setDataset(ds);
    }).catch((err) => { if (active) setError(err.message || 'Error loading data'); });
    return () => { active = false; };
  }, [ticker]);

  const sentiment = dataset?.sentiment;

  const overallLabel = !sentiment ? 'Neutral' : sentiment.overall > 20 ? 'Bullish' : sentiment.overall < -20 ? 'Bearish' : 'Neutral';
  const overallColor = !sentiment ? 'text-gray-400' : sentiment.overall > 20 ? 'text-emerald-400' : sentiment.overall < -20 ? 'text-red-400' : 'text-gray-400';

  const historyData = useMemo(
    () => sentiment?.history.map((h) => ({ date: formatDate(h.timestamp), value: h.value })) ?? [],
    [sentiment?.history]
  );

  const lineColor = !sentiment ? '#9ca3af' : sentiment.overall >= 0 ? '#10b981' : '#ef4444';
  const fillColorStart = !sentiment ? 'transparent' : sentiment.overall >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
  const fillColorEnd = !sentiment ? 'transparent' : sentiment.overall >= 0 ? 'rgba(16,185,129,0)' : 'rgba(239,68,68,0)';

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: 22, left: 33 },
    xAxis: {
      type: 'category',
      data: historyData.map((h) => h.date),
      boundaryGap: false,
      axisLabel: { fontSize: 8, color: '#475569', interval: 6 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: -100,
      max: 100,
      axisLabel: { fontSize: 8, color: '#475569' },
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
    },
    series: [
      {
        type: 'line',
        data: historyData.map((h) => h.value),
        smooth: true,
        lineStyle: { color: lineColor, width: 1.5 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: fillColorStart },
              { offset: 1, color: fillColorEnd },
            ],
          },
        },
        symbol: 'none',
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: 0 }],
          lineStyle: { color: '#475569', type: 'dashed', width: 1 },
          label: { show: false },
        },
      },
    ],
  }), [historyData, lineColor, fillColorStart, fillColorEnd]);

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
      {(!dataset || !sentiment) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10 backdrop-blur-sm rounded-lg">
          <span className="text-xs text-gray-400">Loading sentiment...</span>
        </div>
      )}
      {/* Overall gauge */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Overall Sentiment</span>
          <span className={`text-sm font-bold font-mono ${overallColor}`}>
            {overallLabel} ({sentiment?.overall ? (sentiment.overall > 0 ? '+' : '') + sentiment.overall : 0})
          </span>
        </div>
        {/* Gauge bar */}
        <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="w-1/2 bg-gradient-to-r from-red-500 to-gray-600" />
            <div className="w-1/2 bg-gradient-to-r from-gray-600 to-emerald-500" />
          </div>
          {/* Needle */}
          <div
            className="absolute top-0 w-0.5 h-full bg-white shadow-lg shadow-white/50"
            style={{ left: `${(((sentiment?.overall ?? 0) + 100) / 200) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-red-400">Bearish</span>
          <span className="text-[9px] text-gray-500">Neutral</span>
          <span className="text-[9px] text-emerald-400">Bullish</span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Breakdown</div>
        {sentiment?.breakdown.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-20 shrink-0 truncate">{b.label}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden relative">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 w-px h-full bg-gray-600 z-10" />
              {/* Bar */}
              {b.value >= 0 ? (
                <div
                  className="absolute top-0 h-full bg-emerald-500 rounded-r-full"
                  style={{ left: '50%', width: `${(b.value / 200) * 100}%` }}
                />
              ) : (
                <div
                  className="absolute top-0 h-full bg-red-500 rounded-l-full"
                  style={{ right: '50%', width: `${(-b.value / 200) * 100}%` }}
                />
              )}
            </div>
            <span className={`text-[10px] font-mono w-8 text-right ${b.value > 0 ? 'text-emerald-400' : b.value < 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {b.value > 0 ? '+' : ''}{b.value}
            </span>
          </div>
        ))}
      </div>

      {/* Signals */}
      <div className="space-y-1">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Signals</div>
        <div className="grid grid-cols-2 gap-1">
          {sentiment?.signals.map((s) => {
            const style = DIRECTION_STYLES[s.direction];
            return (
              <div key={s.label} className={`rounded px-2 py-1.5 ${style.bg} border border-gray-700/20`}>
                <div className="text-[10px] text-gray-400 truncate">{s.label}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`text-[10px] font-mono font-bold capitalize ${style.text}`}>{s.direction}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${s.strength}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">{s.strength}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentiment history chart */}
      <div className="flex-1 min-h-[120px]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">30-Day Sentiment</div>
        <ReactECharts option={option} style={{ height: 100, width: '100%' }} notMerge />
      </div>
    </div>
  );
}
