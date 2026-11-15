import { useState } from 'react';
import type { CalendarFeed } from '../../services/researchService';
import { ResearchFrame } from '../ResearchWidgets/shared';
import { useResearch } from '../ResearchWidgets/useResearch';
import { buttonClass } from '../ResearchWidgets/styles';

const currencyFor: Record<string, string> = { US: 'USD', EU: 'EUR', DE: 'EUR', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF' };

export default function EarningsWidget({ ticker }: { ticker: string }) {
  const feed = useResearch<CalendarFeed>('calendar');
  const [allCurrencies, setAllCurrencies] = useState(false);
  const [highOnly, setHighOnly] = useState(false);
  const currencies = ticker === 'DXY' ? ['USD'] : ticker.split('/');
  const events = feed.data?.events.filter((e) => (allCurrencies || currencies.includes(currencyFor[e.country] || e.country)) && (!highOnly || e.impact === 'high')) ?? [];
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <ResearchFrame {...feed} source={feed.data?.source} fetchedAt={feed.data?.fetched_at}>
    <div className="flex gap-2 flex-wrap">
      <button className={buttonClass} aria-pressed={allCurrencies} onClick={() => setAllCurrencies(!allCurrencies)}>{allCurrencies ? 'All currencies' : `${ticker} only`}</button>
      <button className={buttonClass} aria-pressed={highOnly} onClick={() => setHighOnly(!highOnly)}>{highOnly ? 'High impact only' : 'All impact levels'}</button>
    </div>
    <p className="text-[10px] text-gray-500">Times in {zone}. Actuals may be unavailable in this feed. Missing values stay blank.</p>
    {feed.data && events.length === 0 && <p className="text-gray-400">No events match these filters in the current feed.</p>}
    {events.map((e) => <section key={e.id} className="border-t border-gray-700/50 pt-2 space-y-2">
      <div className="flex justify-between gap-2"><span className="font-medium text-gray-200">{currencyFor[e.country] || e.country} · {e.title}</span><span className={e.impact === 'high' ? 'text-amber-300' : 'text-gray-500'}>{e.impact}</span></div>
      <time className="block text-[10px] text-gray-500">{e.time_known ? new Date(e.timestamp).toLocaleString() : `${new Date(e.timestamp).toLocaleDateString(undefined, { timeZone: 'UTC' })} · Time unconfirmed`}</time>
      <div className="grid grid-cols-3 gap-2 text-[11px]">{[['Actual', e.actual], ['Forecast', e.forecast], ['Previous', e.previous]].map(([label, value]) => <div key={label}><span className="block text-gray-500">{label}</span><span className="text-gray-200">{value || '—'}</span></div>)}</div>
      {e.surprise !== null && <p className="text-cyan-300">Actual − forecast: {e.surprise > 0 ? '+' : ''}{e.surprise}{e.actual?.includes('%') ? ' percentage points' : ''}</p>}
    </section>)}
    {feed.data && <p className="text-[10px] text-gray-500">{feed.data.note}</p>}
  </ResearchFrame>;
}
