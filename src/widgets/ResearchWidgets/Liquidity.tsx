import { useState } from 'react';
import type { LiquidityScan } from '../../services/researchService';
import { safeSource } from '../../services/researchService';
import { ResearchFrame } from './shared';
import { useResearch } from './useResearch';
import { fieldClass } from './styles';

export default function Liquidity({ ticker }: { ticker: string }) {
  const [lookback, setLookback] = useState(20);
  const feed = useResearch<LiquidityScan>(`liquidity?ticker=${encodeURIComponent(ticker)}&lookback=${lookback}`);
  const data = feed.data;
  return <ResearchFrame {...feed} source={data?.source} fetchedAt={data?.fetched_at}>
    <label className="flex items-center gap-3 text-gray-400">Prior daily bars
      <select aria-label="Liquidity lookback" className={fieldClass} value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>{[5, 10, 20, 60].map((n) => <option key={n}>{n}</option>)}</select>
    </label>
    <p className="text-gray-400 leading-relaxed">A sweep candidate breaches the preceding range and closes back inside. A close outside is labelled breakout. Both sides can be breached in one candle.</p>
    {data && <>
      <p className="text-[10px] text-gray-500">{data.bars_used} completed daily bars. Latest bar: {data.as_of ? new Date(data.as_of).toLocaleDateString() : 'unavailable'}. Today’s bar is excluded.</p>
      {data.as_of && new Date(data.fetched_at).getTime() - data.as_of > 5 * 86_400_000 && <p className="text-amber-300">Price history is over five days old; these are historical patterns.</p>}
      {data.status === 'insufficient' && <p className="text-amber-300">Not enough completed candles for this lookback.</p>}
      {data.status === 'available' && data.signals.length === 0 && <p className="text-gray-500">No range breaches found in the available history.</p>}
      {data.signals.map((s) => <div key={`${s.timestamp}-${s.side}`} className="border-t border-gray-700/50 pt-2 space-y-1">
        <div className="flex justify-between"><span className={s.outcome === 'rejection' ? 'text-amber-300' : 'text-cyan-300'}>{s.side === 'high' ? 'Prior highs' : 'Prior lows'} · {s.outcome}</span><time className="text-gray-500">{new Date(s.timestamp).toLocaleDateString()}</time></div>
        <div className="text-gray-400">Level {s.level.toFixed(ticker.includes('JPY') ? 3 : 5)} · Close {s.close.toFixed(ticker.includes('JPY') ? 3 : 5)}</div>
      </div>)}
      <p className="text-[10px] text-gray-500">{data.note} <a className="text-cyan-400 underline" href={safeSource(data.source_url)} target="_blank" rel="noopener noreferrer">Price source</a></p>
    </>}
  </ResearchFrame>;
}
