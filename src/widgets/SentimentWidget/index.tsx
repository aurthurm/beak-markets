import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';

type Props = { ticker: string };

const DIRECTION_STYLES = {
  bullish: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', bar: 'bg-emerald-500' },
  bearish: { text: 'text-red-400', bg: 'bg-red-500/15', bar: 'bg-red-500' },
  neutral: { text: 'text-gray-400', bg: 'bg-gray-500/15', bar: 'bg-gray-500' },
};

export default function SentimentWidget({ ticker }: Props) {
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const sentiment = dataset.sentiment;

  const overallLabel = sentiment.overall > 20 ? 'Bullish' : sentiment.overall < -20 ? 'Bearish' : 'Neutral';
  const overallColor = sentiment.overall > 20 ? 'text-emerald-400' : sentiment.overall < -20 ? 'text-red-400' : 'text-gray-400';
  const overallBg = sentiment.overall > 20 ? 'from-emerald-500' : sentiment.overall < -20 ? 'from-red-500' : 'from-gray-500';

  const historyData = useMemo(
    () => sentiment.history.map((h) => ({ date: formatDate(h.timestamp), value: h.value })),
    [sentiment.history]
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Overall gauge */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Overall Sentiment</span>
          <span className={`text-sm font-bold font-mono ${overallColor}`}>
            {overallLabel} ({sentiment.overall > 0 ? '+' : ''}{sentiment.overall})
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
            style={{ left: `${((sentiment.overall + 100) / 200) * 100}%` }}
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
        {sentiment.breakdown.map((b) => (
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
          {sentiment.signals.map((s) => {
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
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">30-Day Sentiment</div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`sentGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sentiment.overall >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={sentiment.overall >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#475569' }} interval={6} />
            <YAxis domain={[-100, 100]} tick={{ fontSize: 8, fill: '#475569' }} width={30} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={sentiment.overall >= 0 ? '#10b981' : '#ef4444'}
              fill={`url(#sentGrad-${ticker})`}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
