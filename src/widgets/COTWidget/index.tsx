import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useResearch } from '../ResearchWidgets/useResearch';
import { ResearchFrame } from '../ResearchWidgets/shared';
import { formatDate, formatCompact } from '../../utils/format';
import type { MarketDataset } from '../../types';

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
  change: number | null;
}) {
  const netColor = net >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeColor = change !== null && change >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeSign = change !== null && change >= 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between border-b border-gray-700/50 py-2 last:border-0">
      <span className="w-24 shrink-0 text-xs text-gray-400">{label}</span>
      <div className="flex flex-1 items-center justify-between gap-4 font-mono text-[10px]">
        <span className="w-14 text-right text-gray-500">{formatCompact(long)} L</span>
        <span className="w-14 text-right text-gray-500">{formatCompact(short)} S</span>
        <span className={`w-14 text-right font-semibold ${netColor}`}>{formatCompact(net)}</span>
        <span className={`w-12 text-right ${changeColor}`}>
          {changeSign}
          {change === null ? '—' : formatCompact(change)}
        </span>
      </div>
    </div>
  );
}

function COTContent({ cot }: { cot: NonNullable<MarketDataset['cot']> }) {
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

  const option = useMemo(
    () => ({
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
        formatter: (params: { color: string; seriesName: string; value: number | null }[]) =>
          params
            .map(
              (p) =>
                `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value != null ? formatCompact(p.value) : '--'}`
            )
            .join('<br/>'),
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
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
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
    }),
    [historyData, maxAbs]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-cyan-400">{cot.instrument}</span>
          <span className="ml-2 text-[10px] text-gray-500">CFTC Commitment of Traders</span>
        </div>
        <span className="text-[10px] text-gray-500">As of {formatDate(cot.reportDate)}</span>
      </div>

      <div className="rounded-lg border border-gray-700/30 bg-gray-800/50 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Open Interest</div>
        <div className="text-sm font-bold font-mono text-white">{formatCompact(cot.openInterest)}</div>
      </div>

      <div className="rounded-lg border border-gray-700/30 bg-gray-800/30 px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
          <span className="w-24">Group</span>
          <div className="flex flex-1 justify-end gap-4">
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

      <div className="min-h-[120px] flex-1">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Weekly net positions (contracts)</div>
        <ReactECharts option={option} style={{ height: 100, width: '100%' }} notMerge />
        <div className="mt-1 flex justify-center gap-4">
          <span className="text-[9px] text-blue-400">● Commercial (hedgers)</span>
          <span className="text-[9px] text-amber-400">— Non-Commercial (speculators)</span>
        </div>
      </div>
    </div>
  );
}

type CotFeed = {
  source: string; fetched_at: string; note: string; contract: string;
  reports: { date: string; open_interest: number; groups: { label: string; long: number; short: number; net: number }[] }[];
};

export default function COTWidget({ ticker }: Props) {
  const feed = useResearch<CotFeed>(`cot?ticker=${encodeURIComponent(ticker)}`);
  const data = feed.data;
  const latest = data?.reports[0];
  const previous = data?.reports[1];
  const cot = latest && data ? {
    instrument: data.contract,
    reportDate: Date.parse(latest.date),
    openInterest: latest.open_interest,
    ...Object.fromEntries(['Commercial', 'Non-commercial', 'Non-reportable'].map((label, index) => {
      const group = latest.groups.find((row) => row.label === label)!;
      const old = previous?.groups.find((row) => row.label === label);
      return [['commercial', 'nonCommercial', 'nonReportable'][index], { ...group, change: old ? group.net - old.net : null }];
    })),
    history: [...data.reports].reverse().map((report) => ({
      timestamp: Date.parse(report.date),
      netCommercial: report.groups.find((row) => row.label === 'Commercial')!.net,
      netNonCommercial: report.groups.find((row) => row.label === 'Non-commercial')!.net,
    })),
  } as NonNullable<MarketDataset['cot']> : null;
  return <ResearchFrame {...feed} source={data?.source} fetchedAt={data?.fetched_at}>
    {cot && <COTContent cot={cot} />}
    {data && <p className="text-[10px] text-gray-500 mt-3">{data.note}</p>}
  </ResearchFrame>;
}
