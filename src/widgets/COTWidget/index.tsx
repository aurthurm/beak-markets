import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { marketService } from '../../services/marketService';
import { formatDate, formatCompact } from '../../utils/format';

type Props = { ticker: string };

function PositionRow({
  label,
  long,
  short,
  net,
  change,
}: {
  label: string;
  long: number;
  short: number;
  net: number;
  change: number;
}) {
  const netColor = net >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeColor = change >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeSign = change >= 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-between gap-4 text-[10px] font-mono">
        <span className="text-gray-500 w-14 text-right">{formatCompact(long)} L</span>
        <span className="text-gray-500 w-14 text-right">{formatCompact(short)} S</span>
        <span className={`w-14 text-right font-semibold ${netColor}`}>{formatCompact(net)}</span>
        <span className={`w-12 text-right ${changeColor}`}>
          {changeSign}{formatCompact(change)}
        </span>
      </div>
    </div>
  );
}

export default function COTWidget({ ticker }: Props) {
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const cot = dataset.cot;

  if (!cot) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500 text-sm">
        No COT data for {ticker}
      </div>
    );
  }

  const historyData = useMemo(
    () =>
      cot.history.map((h) => ({
        date: formatDate(h.timestamp),
        commercial: h.netCommercial,
        nonCommercial: h.netNonCommercial,
      })),
    [cot.history]
  );

  const maxAbs = useMemo(() => {
    const vals = cot.history.flatMap((h) => [Math.abs(h.netCommercial), Math.abs(h.netNonCommercial)]);
    return Math.max(...vals, 1);
  }, [cot.history]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 5, right: 5, bottom: 22, left: 38 },
    xAxis: {
      type: 'category',
      data: historyData.map((h) => h.date),
      boundaryGap: false,
      axisLabel: { fontSize: 8, color: '#475569', interval: 3 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: -maxAbs,
      max: maxAbs,
      axisLabel: {
        fontSize: 8,
        color: '#475569',
        formatter: (v: number) => formatCompact(v),
      },
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
          `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value != null ? formatCompact(p.value) : '--'}`
        ).join('<br/>'),
    },
    series: [
      {
        name: 'Commercial',
        type: 'line',
        data: historyData.map((h) => h.commercial),
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 1.5 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.3)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
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
      {
        name: 'Non-Commercial',
        type: 'line',
        data: historyData.map((h) => h.nonCommercial),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'none',
      },
    ],
  }), [historyData, maxAbs]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-cyan-400">{cot.instrument}</span>
          <span className="text-[10px] text-gray-500 ml-2">CFTC Commitment of Traders</span>
        </div>
        <span className="text-[10px] text-gray-500">As of {formatDate(cot.reportDate)}</span>
      </div>

      {/* Open Interest */}
      <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Open Interest</div>
        <div className="text-sm font-bold font-mono text-white">{formatCompact(cot.openInterest)}</div>
      </div>

      {/* Position table */}
      <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/30">
        <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          <span className="w-24">Group</span>
          <div className="flex-1 flex justify-end gap-4">
            <span className="w-14 text-right">Long</span>
            <span className="w-14 text-right">Short</span>
            <span className="w-14 text-right">Net</span>
            <span className="w-12 text-right">Δ</span>
          </div>
        </div>
        <PositionRow
          label="Commercial"
          long={cot.commercial.long}
          short={cot.commercial.short}
          net={cot.commercial.net}
          change={cot.commercial.change}
        />
        <PositionRow
          label="Non-Commercial"
          long={cot.nonCommercial.long}
          short={cot.nonCommercial.short}
          net={cot.nonCommercial.net}
          change={cot.nonCommercial.change}
        />
        <PositionRow
          label="Non-Reportable"
          long={cot.nonReportable.long}
          short={cot.nonReportable.short}
          net={cot.nonReportable.net}
          change={cot.nonReportable.change}
        />
      </div>

      {/* Net positioning history */}
      <div className="flex-1 min-h-[120px]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          12-Week Net Position
        </div>
        <ReactECharts option={option} style={{ height: 100, width: '100%' }} notMerge />
        <div className="flex gap-4 mt-1 justify-center">
          <span className="text-[9px] text-blue-400">● Commercial (hedgers)</span>
          <span className="text-[9px] text-amber-400">— Non-Commercial (speculators)</span>
        </div>
      </div>
    </div>
  );
}
