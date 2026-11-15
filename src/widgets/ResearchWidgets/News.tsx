import { useState } from 'react';
import { safeSource } from '../../services/researchService';
import { ResearchFrame } from './shared';
import { useResearch } from './useResearch';
import { fieldClass } from './styles';

type Feed = { source: string; fetched_at: string; note: string; warnings: string[]; articles: { id: string; headline: string; url: string; source: string; currency: string; published_at: string | null; summary: string }[] };
export default function News({ ticker }: { ticker: string }) {
  const feed = useResearch<Feed>(`news?ticker=${encodeURIComponent(ticker)}`);
  const [query, setQuery] = useState('');
  const items = feed.data?.articles.filter((a) => `${a.headline} ${a.summary}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  return <ResearchFrame {...feed} source={feed.data?.source} fetchedAt={feed.data?.fetched_at}>
    <input className={fieldClass} aria-label="Filter headlines" placeholder="Filter headlines" value={query} onChange={(e) => setQuery(e.target.value)} />
    {feed.data?.warnings.map((source) => <p key={source} className="text-amber-300">{source} unavailable; showing the other sources.</p>)}
    {feed.data && items.length === 0 && <p className="text-gray-400">No matching announcements for this pair in the available feeds.</p>}
    {items.map((a) => <article key={a.id} className="border-t border-gray-700/50 pt-3 space-y-2">
      <a className="text-gray-100 hover:text-cyan-300" href={safeSource(a.url)} target="_blank" rel="noopener noreferrer">{a.headline}</a>
      <p className="text-[10px] text-cyan-400">{a.source} · {a.currency}</p>
      <time className="text-[10px] text-gray-500">{a.published_at ? new Date(a.published_at).toLocaleString() : 'Publication time unavailable'}</time>
      <p className="text-gray-400 leading-relaxed">{a.summary}</p>
    </article>)}
    {feed.data && <p className="text-[10px] text-gray-500">{feed.data.note}</p>}
  </ResearchFrame>;
}
