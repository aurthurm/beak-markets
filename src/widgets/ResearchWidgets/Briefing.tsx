import { useState } from 'react';
import type { WidgetConfig } from '../../types';
import { useCanvasStore } from '../../store/useCanvasStore';
import { briefingAction, type BriefingFeed, type BriefingSource, type CitedPoint, type SavedBriefing } from '../../services/briefingService';
import { briefingPeriodLabel, shiftBriefingDate } from '../../services/briefingMath';
import { safeSource } from '../../services/researchService';
import { useResearch } from './useResearch';
import { buttonClass, fieldClass } from './styles';

const kindLabel: Record<string, string> = { official: 'Official statement', news: 'News report', opinion: 'Analyst opinion', economic_event: 'Calendar event' };

function Citations({ ids, sources }: { ids: string[]; sources: BriefingSource[] }) {
  return <span className="inline-flex flex-wrap gap-1 ml-1">{ids.map((id) => {
    const index = sources.findIndex((source) => source.id === id);
    const source = sources[index];
    return source && safeSource(source.url) ? <a key={id} href={safeSource(source.url)} target="_blank" rel="noopener noreferrer" title={`${source.source}: ${source.headline}`} aria-label={`Source ${index + 1}: ${source.source} — ${source.headline}`} className="text-amber-300 hover:underline font-mono text-[10px]">[{index + 1}]</a> : null;
  })}</span>;
}

function Point({ point, sources }: { point: CitedPoint; sources: BriefingSource[] }) {
  return <p className="text-gray-300 leading-relaxed">{point.text}<Citations ids={point.source_ids} sources={sources} /></p>;
}

function Summary({ summary }: { summary: SavedBriefing }) {
  const content = summary.content;
  return <section className="space-y-4" aria-label="Saved AI briefing">
    <div className="border-l-2 border-amber-400 pl-3 space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">AI interpretation · {content.risk_tone.replaceAll('_', ' ')}</p>
      <h2 className="text-base leading-snug text-gray-50 font-semibold">{content.headline}</h2>
      <Point point={content.overview} sources={summary.sources} />
    </div>
    <Point point={content.sentiment_reason} sources={summary.sources} />
    {([
      ['Macro drivers', content.macro_drivers], ['Analyst perspectives', content.analyst_views],
      ['Counterarguments', content.counterarguments], ['Catalysts to watch', content.watch_next],
    ] as const).map(([title, points]) => points.length > 0 && <section key={title} className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-widest font-mono text-gray-500">{title}</h3>
      {points.map((point, index) => <Point key={index} point={point} sources={summary.sources} />)}
    </section>)}
    <section className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-widest font-mono text-gray-500">Conditional trade watchlist</h3>
      {content.trade_scenarios.length === 0 && <p className="text-gray-400">No supported trade scenario in this evidence set.</p>}
      {content.trade_scenarios.map((idea, index) => <article key={index} className="rounded border border-gray-700/70 bg-gray-950/60 p-3 space-y-2">
        <div className="flex justify-between gap-3"><span className="text-cyan-300 font-mono font-semibold">{idea.pair}</span><span className="text-amber-300 text-[10px]">{idea.direction.replaceAll('_', ' ')}</span></div>
        <p className="text-gray-200">{idea.thesis}<Citations ids={idea.source_ids} sources={summary.sources} /></p>
        {([['Catalyst', idea.catalyst], ['Confirmation needed', idea.confirmation], ['Invalidation', idea.invalidation], ['Risks', idea.risks]] as const).map(([label, value]) => <p key={label} className="text-gray-400 leading-relaxed"><span className="text-gray-500">{label}: </span>{value}</p>)}
      </article>)}
    </section>
    <p className="rounded border border-gray-700/60 p-2 text-[10px] leading-relaxed text-gray-400">{content.coverage_limits}</p>
    <p className="text-[10px] text-gray-500">Saved {new Date(summary.generated_at).toLocaleString()} · {summary.model} · {summary.sources.length} evidence items. Sentiment is an AI interpretation of this sample. Trade ideas need independent confirmation.</p>
  </section>;
}

export default function Briefing({ data, ticker }: { data: WidgetConfig; ticker: string }) {
  const update = useCanvasStore((store) => store.updateWidgetData);
  const cadence = data.settings.briefingCadence === 'daily' ? 'daily' : 'weekly';
  const pairScope = data.settings.briefingScope === 'pair';
  const anchor = typeof data.settings.briefingAnchor === 'string' ? data.settings.briefingAnchor : '';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scope = pairScope ? ticker : 'global';
  const path = `briefings?${new URLSearchParams({ cadence, timezone: zone, scope, count: cadence === 'daily' ? '10' : '6', ...(anchor ? { anchor } : {}) })}`;
  const feed = useResearch<BriefingFeed>(path);
  const [selected, setSelected] = useState<{ path: string; start: string } | null>(() => typeof data.settings.briefingSelectedStart === 'string' ? { path, start: data.settings.briefingSelectedStart } : null);
  const [kind, setKind] = useState('all');
  const [paidConsent, setPaidConsent] = useState(false);
  const [operation, setOperation] = useState<{ path: string; busy: boolean; action?: 'collect' | 'generate'; message?: string; error?: string } | null>(null);
  const busy = operation?.busy ?? false;
  const change = (values: Record<string, unknown>) => {
    setPaidConsent(false);
    setSelected(null);
    update(data.id, { settings: { ...data.settings, briefingSelectedStart: '', ...values } });
  };
  const periods = feed.data?.periods ?? [];
  const period = periods.find((item) => selected?.path === path && item.start === selected.start) ?? periods[0];
  const sources = period?.items.filter((item) => kind === 'all' || item.kind === kind) ?? [];
  const canGenerate = !!period && !period.future && period.items.some((item) => item.kind !== 'economic_event');
  const run = async (action: 'collect' | 'generate') => {
    setOperation({ path, busy: true, action });
    try {
      await briefingAction(action, action === 'collect' ? {} : { cadence, period_start: period?.start, timezone: zone, scope, allow_paid: paidConsent });
      setOperation({ path, busy: false, message: action === 'collect' ? 'Source archive refreshed. No AI request made.' : 'Briefing saved. Reading it again is free.' });
      setPaidConsent(false);
      feed.refresh();
    } catch (error) {
      setOperation({ path, busy: false, error: error instanceof Error ? error.message : 'Briefing request failed.' });
      setPaidConsent(false);
    }
  };
  return <div className="nodrag nowheel h-full min-h-0 flex flex-col gap-3 text-xs" aria-label="AI macro briefing widget">
    <div className="flex items-center justify-between gap-2">
      <div><p className="text-[10px] uppercase tracking-[0.2em] font-mono text-amber-300">The macro briefing</p><p className="text-gray-500 text-[10px] mt-1">News → interpretation → conditional scenarios</p></div>
      <button className={buttonClass} disabled={busy} onClick={() => void run('collect')}>{busy && operation?.path === path ? 'Working…' : 'Refresh sources'}</button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded border border-gray-700 p-0.5" aria-label="Briefing cadence">
        {(['daily', 'weekly'] as const).map((value) => <button key={value} aria-pressed={cadence === value} disabled={busy} onClick={() => change({ briefingCadence: value, briefingAnchor: '' })} className={`px-3 py-1 text-[11px] rounded ${cadence === value ? 'bg-amber-400/15 text-amber-200' : 'text-gray-400'}`}>{value === 'daily' ? 'Daily' : 'Weekly'}</button>)}
      </div>
      <select aria-label="Briefing scope" className={`${fieldClass} !w-auto flex-1 min-w-28`} disabled={busy} value={pairScope ? 'pair' : 'global'} onChange={(event) => change({ briefingScope: event.target.value })}><option value="global">Global macro</option><option value="pair">{ticker} related</option></select>
      <input aria-label="Briefing anchor date" type="date" className={`${fieldClass} !w-auto`} value={anchor} disabled={busy} onChange={(event) => change({ briefingAnchor: event.target.value })} />
    </div>
    <div className="flex gap-2 flex-wrap text-[10px]">
      <button className="text-cyan-300 hover:underline" disabled={busy} onClick={() => change({ briefingCadence: 'daily', briefingAnchor: '' })}>Today</button>
      <button className="text-cyan-300 hover:underline" disabled={busy} onClick={() => change({ briefingCadence: 'weekly', briefingAnchor: '' })}>This week</button>
      <button className="text-cyan-300 hover:underline" disabled={busy || !feed.data} onClick={() => change({ briefingCadence: 'weekly', briefingAnchor: shiftBriefingDate(feed.data!.local_today, -7) })}>Last week</button>
      <span className="text-gray-600 ml-auto">{zone} · Monday–Sunday weeks</span>
    </div>
    {feed.error && <div role="alert" className="text-amber-300 border border-amber-500/30 rounded p-2">{feed.error} <button className="underline" onClick={feed.refresh}>Retry</button></div>}
    {operation?.path === path && operation.error && <p role="alert" className="text-amber-300">{operation.error}</p>}
    {operation?.path === path && operation.message && <p role="status" className="text-cyan-300 text-[10px]">{operation.message}</p>}
    {busy && <p role="status" className="text-amber-200 text-[10px]">{operation?.action === 'collect' ? 'Collecting source feeds. No AI request is being made.' : 'Generating this briefing. This can take up to 100 seconds; no automatic paid retry will be made.'}</p>}
    {feed.loading && <p role="status" className="text-gray-500">Loading archived briefings…</p>}
    <nav className="flex gap-2 overflow-x-auto shrink-0 pb-1" aria-label="Briefing periods">
      {periods.map((item) => <button key={item.start} disabled={busy} aria-pressed={period?.start === item.start} onClick={() => { change({ briefingSelectedStart: item.start }); setSelected({ path, start: item.start }); }} className={`shrink-0 min-w-28 rounded border px-3 py-2 text-left ${item.start === period?.start ? 'border-amber-400/60 bg-amber-400/5' : 'border-gray-800 hover:border-gray-600'}`}>
        <span className="block text-gray-200">{briefingPeriodLabel(item.start, cadence, feed.data!.local_today)}</span>
        <span className="block text-[10px] text-gray-500 mt-1">{item.item_count} items · {item.summary ? 'AI saved' : 'No AI summary'}</span>
      </button>)}
    </nav>
    <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
      {period && <>
        <div className="flex justify-between gap-2 border-b border-gray-800 pb-2"><h2 className="text-gray-200 font-semibold">{period.start}{cadence === 'weekly' ? ` — ${shiftBriefingDate(period.end, -1)}` : ''}</h2><span className="text-[10px] text-gray-500">{period.future ? 'Scheduled window' : period.partial ? 'In progress' : 'Archived window'} · {period.source_count} sources</span></div>
        {period.summary?.sources_changed && <p className="text-amber-300 text-[10px]">Sources changed since this saved briefing. It still shows the evidence snapshot used at generation.</p>}
        {period.summary ? <Summary summary={period.summary} /> : <div className="rounded border border-dashed border-gray-700 p-3 space-y-2">
          <p className="text-gray-300">{period.future ? 'Future window: scheduled events only. AI generation is disabled until this period begins.' : period.item_count ? 'Sources are ready to review. No AI summary generated for this period.' : 'No dated sources archived for this period yet.'}</p>
          <p className="text-gray-500 text-[11px]">Refresh sources to collect available news and analyst opinions. Past weeks are limited by feed history; an empty day does not mean nothing happened.</p>
        </div>}
        {!period.future && (!period.summary || period.summary.sources_changed) && <div className="rounded border border-amber-500/20 bg-amber-400/[0.03] p-3 space-y-2">
          {!feed.data?.ai.configured && <p className="text-amber-200 text-[11px]">OpenAI needs a backend API key. Set OPENAI_API_KEY and restart the backend. Keep the key out of this canvas.</p>}
          <p className="text-gray-500 text-[10px]">{feed.data?.ai.model} · Selected source headlines and short excerpts are sent to OpenAI. One paid request; saved summaries are reused.</p>
          <label className="flex gap-2 items-center text-gray-400 text-[11px]"><input type="checkbox" checked={paidConsent} disabled={busy || !feed.data?.ai.configured || !canGenerate} onChange={(event) => setPaidConsent(event.target.checked)} />Allow one paid OpenAI generation for this period</label>
          <button className="rounded bg-amber-400/15 border border-amber-400/40 px-3 py-1.5 text-amber-200 disabled:opacity-40" disabled={busy || !paidConsent || !feed.data?.ai.configured || !canGenerate} onClick={() => void run('generate')}>{busy ? 'Working…' : 'Generate AI briefing · paid'}</button>
        </div>}
        <section className="space-y-2" aria-label="Briefing evidence">
          <div className="flex justify-between items-center gap-3"><h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">Read the evidence</h3><select aria-label="Evidence type" value={kind} onChange={(event) => setKind(event.target.value)} className={`${fieldClass} !w-auto`}><option value="all">All source types</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {sources.length === 0 && <p className="text-gray-500">No matching source items in this period.</p>}
          {sources.map((item) => <article key={item.id} className="border-t border-gray-800 pt-3 space-y-1.5">
            <div className="flex justify-between gap-2 text-[10px]"><span className={item.kind === 'opinion' ? 'text-amber-300' : 'text-cyan-400'}>{item.source} · {kindLabel[item.kind]}</span><time className="text-gray-500">{item.published_at ? new Date(item.published_at).toLocaleString() : 'Date unknown'}</time></div>
            {item.kind === 'economic_event' && item.published_at && item.published_at > period.as_of && <p className="text-[10px] text-amber-300">Upcoming scheduled event · actual outcome unknown</p>}
            <a href={safeSource(item.url)} target="_blank" rel="noopener noreferrer" className="text-gray-200 hover:text-cyan-300 leading-relaxed block">{item.headline}</a>
            {item.excerpt && <p className="text-[11px] text-gray-500 leading-relaxed">{item.excerpt.slice(0, 300)}{item.excerpt.length > 300 ? '…' : ''}</p>}
          </article>)}
          {period.item_count > period.items.length && <p className="text-[10px] text-gray-500">Showing the latest {period.items.length} of {period.item_count} archived items for this period.</p>}
        </section>
      </>}
      {feed.data && <details className="border-t border-gray-800 pt-2 text-[10px] text-gray-500"><summary className="cursor-pointer">Source coverage · {feed.data.archive_count} archived items</summary><p className="mt-2 leading-relaxed">{feed.data.note} Pair-related filtering uses currency keywords; it is a relevance aid and can miss indirect macro links.</p>{feed.data.undated_count > 0 && <p>{feed.data.undated_count} undated items excluded.</p>}{feed.data.feeds.map((source) => <p key={source.url} className="mt-1">{source.source}: {source.status} · {source.item_count} items · checked {new Date(source.checked_at).toLocaleString()}</p>)}</details>}
    </div>
  </div>;
}
