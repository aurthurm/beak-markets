import { useTickerStore } from '../../store/useTickerStore';
import type { ResearchBoard } from '../../services/researchService';
import { safeSource } from '../../services/researchService';
import { ResearchFrame } from './shared';
import { useResearch } from './useResearch';
import { buttonClass } from './styles';

export default function MacroBoard() {
  const feed = useResearch<ResearchBoard>('board');
  const setTicker = useTickerStore((s) => s.setGlobalTicker);
  return <ResearchFrame {...feed} source={feed.data?.source} fetchedAt={feed.data?.checked_at}>
    <p className="text-gray-400 leading-relaxed">Compare saved macro views. Ranked by model confidence, which is self-reported and is not a win probability. Views older than 24 hours are marked stale.</p>
    {feed.data?.rows.map(({ ticker, status, analysis }) => <section key={ticker} className="border-t border-gray-700/60 pt-3 space-y-2">
      <div className="flex justify-between items-center gap-2">
        <button className={buttonClass} onClick={() => setTicker(ticker)} title="Show this pair in synced widgets">{ticker}</button>
        <span className={status === 'available' ? 'text-cyan-300' : 'text-amber-300'}>{status}</span>
      </div>
      {analysis ? <>
        <div className="flex justify-between gap-2"><span className={analysis.stance === 'bullish' ? 'text-emerald-400' : analysis.stance === 'bearish' ? 'text-red-400' : 'text-gray-400'}>{analysis.stance} · {Math.round(analysis.confidence * 100)}% model confidence</span><span className="text-gray-500">{analysis.article_count} articles</span></div>
        <p className="text-gray-200">{analysis.headline}</p>
        {analysis.divergence_notes && <p className="text-cyan-200/80">{analysis.divergence_notes}</p>}
        {[...analysis.drivers.slice(0, 2).map((d) => ({ ...d, kind: 'Driver' })), ...analysis.counterpoints.slice(0, 1).map((d) => ({ ...d, kind: 'Counterpoint' }))].map((d, i) => <p key={i} className="text-gray-400 leading-relaxed"><span className="text-gray-500">{d.kind}: </span>{d.claim} {safeSource(d.source_url) && <a href={safeSource(d.source_url)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">{d.source || 'Source'}</a>}</p>)}
        <time className="block text-[10px] text-gray-500">Analysis {new Date(analysis.generated_at).toLocaleString()}</time>
      </> : <p className="text-gray-500">{status === 'unavailable' ? 'Could not read saved analysis. Check the backend connection.' : 'No sourced analysis yet. Configure ANALYSIS_API_URL on the backend to reuse the existing markets-ai-analysis service.'}</p>}
    </section>)}
    <p className="text-[10px] text-gray-500">Refreshing reads saved analyses; it does not request new AI analysis.</p>
  </ResearchFrame>;
}
