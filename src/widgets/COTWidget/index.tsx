import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ComposedChart,
  Line,
} from 'recharts';
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
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          12-Week Net Position
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={historyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`cotComm-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`cotSpec-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#475569' }} interval={3} />
            <YAxis domain={[-maxAbs, maxAbs]} tick={{ fontSize: 8, fill: '#475569' }} width={35} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: 10,
              }}
              formatter={(value: number | undefined) => [value != null ? formatCompact(value) : '', '']}
            />
            <Area
              type="monotone"
              dataKey="commercial"
              stroke="#3b82f6"
              fill={`url(#cotComm-${ticker})`}
              strokeWidth={1.5}
              name="Commercial"
            />
            <Line
              type="monotone"
              dataKey="nonCommercial"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Non-Commercial"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1 justify-center">
          <span className="text-[9px] text-blue-400">● Commercial (hedgers)</span>
          <span className="text-[9px] text-amber-400">— Non-Commercial (speculators)</span>
        </div>
      </div>
    </div>
  );
}
