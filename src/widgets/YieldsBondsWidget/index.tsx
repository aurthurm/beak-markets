import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';

type Props = { ticker: string };

function YieldRow({ tenor, yield: y, change }: { tenor: string; yield: number; change: number }) {
  const changeColor = change >= 0 ? 'text-red-400' : 'text-emerald-400';
  const changeSign = change >= 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-xs text-gray-400 w-12 shrink-0 font-mono">{tenor}</span>
      <div className="flex-1 flex items-center justify-between gap-3">
        <span className="text-sm font-bold font-mono text-white">{y.toFixed(2)}%</span>
        <span className={`text-[10px] font-mono ${changeColor}`}>
          {changeSign}{change} bp
        </span>
      </div>
    </div>
  );
}

export default function YieldsBondsWidget({ ticker }: Props) {
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const yields = dataset.yields;

  if (!yields) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500 text-sm">
        No yields data for {ticker}
      </div>
    );
  }

  const historyData = useMemo(
    () =>
      yields.history.map((h) => ({
        date: formatDate(h.timestamp),
        y2: h.y2,
        y10: h.y10,
      })),
    [yields.history]
  );

  const spreadColor = yields.spread2s10s >= 0 ? 'text-emerald-400' : 'text-amber-400';
  const spreadLabel = yields.spread2s10s >= 0 ? 'Normal' : 'Inverted';

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: 22, left: 38 },
    xAxis: {
      type: 'category',
      data: historyData.map((h) => h.date),
      boundaryGap: false,
      axisLabel: { fontSize: 8, color: '#475569', interval: 7 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 8, color: '#475569', formatter: '{value}%' },
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
      formatter: (params: any[]) =>
        params.map((p) =>
          `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value != null ? `${p.value}%` : '--'}`
        ).join('<br/>'),
    },
    series: [
      {
        name: '2Y',
        type: 'line',
        data: historyData.map((h) => h.y2),
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        symbol: 'none',
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: 0 }],
          lineStyle: { color: '#475569', type: 'dashed', width: 1 },
          label: { show: false },
        },
      },
      {
        name: '10Y',
        type: 'line',
        data: historyData.map((h) => h.y10),
        smooth: true,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        symbol: 'none',
      },
    ],
  }), [historyData]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-cyan-400">
          {yields.country} Treasury Yields
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">2s10s Spread</div>
          <div className={`text-sm font-bold font-mono ${spreadColor}`}>
            {yields.spread2s10s >= 0 ? '+' : ''}{yields.spread2s10s}%
          </div>
          <div className="text-[9px] text-gray-500">{spreadLabel}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">10Y Real Yield</div>
          <div className={`text-sm font-bold font-mono ${yields.realYield10Y >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {yields.realYield10Y >= 0 ? '+' : ''}{yields.realYield10Y}%
          </div>
          <div className="text-[9px] text-gray-500">TIPS implied</div>
        </div>
      </div>

      {/* Yield table */}
      <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/30">
        <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          <span className="w-12">Tenor</span>
          <div className="flex-1 flex justify-end gap-3">
            <span>Yield</span>
            <span className="w-14 text-right">Change</span>
          </div>
        </div>
        {yields.yields.map((y) => (
          <YieldRow key={y.tenor} tenor={y.tenor} yield={y.yield} change={y.change} />
        ))}
      </div>

      {/* Yield curve history */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          30-Day 2Y vs 10Y
        </div>
        <ReactECharts option={option} style={{ height: 120, width: '100%' }} notMerge />
        <div className="flex gap-4 mt-1 justify-center">
          <span className="text-[9px] text-blue-400">— 2Y</span>
          <span className="text-[9px] text-emerald-400">— 10Y</span>
        </div>
      </div>
    </div>
  );
}
