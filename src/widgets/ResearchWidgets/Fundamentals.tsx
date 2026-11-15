import { ResearchFrame } from './shared';
import { useResearch } from './useResearch';

type Kind = 'financials' | 'interestRates' | 'valuation' | 'yields' | 'cot' | 'sentiment';
type Row = { currency?: string; tenor?: string; series?: string; frequency?: string; source_url?: string; status?: string; latest?: { date: string; value: number } | null; data?: { [key: string]: { year: number; value: number }[] | string } | null; window?: number; change_pct?: number };
type Feed = { source: string; fetched_at: string; note: string; rows?: Row[]; differential?: number | null; as_of?: number; contract?: string; reports?: { date: string; groups: { label: string; long: number; short: number; net: number }[] }[] };
const paths: Record<Kind,string> = { financials:'macro', interestRates:'rates', valuation:'rates', yields:'yields', cot:'cot', sentiment:'momentum' };
const indicators = { gdp_growth:'GDP growth (annual %)', cpi:'Inflation (annual %)', unemployment:'Unemployment (%)', current_account:'Current account (% GDP)' };

export default function Fundamentals({ ticker, kind }: { ticker: string; kind: Kind }) {
  const feed = useResearch<Feed>(`${paths[kind]}?ticker=${encodeURIComponent(ticker)}`);
  const data=feed.data;
  return <ResearchFrame {...feed} source={data?.source} fetchedAt={data?.fetched_at}>
    {kind === 'financials' && data?.rows?.map((row) => <section key={row.currency} className="space-y-2">
      <h3 className="text-cyan-300">{row.currency} · {row.status}</h3>
      {Object.entries(indicators).map(([key,label]) => {
        const values=row.data?.[key]; const series=Array.isArray(values) ? values : []; const latest=series[0];
        return <div key={key} className="flex justify-between border-b border-gray-700/40 py-2 gap-3"><span className="text-gray-400">{label}</span><span className="text-gray-100">{latest ? `${latest.value.toFixed(2)}% (${latest.year})` : 'Unavailable'}</span></div>;
      })}
    </section>)}
    {['interestRates','valuation','yields'].includes(kind) && <>
      {data?.rows?.map((r) => <div key={r.currency || r.tenor} className="border-b border-gray-700/50 py-3 flex justify-between gap-3"><div><p className="text-cyan-300">{r.currency || r.tenor}</p><p className="text-[10px] text-gray-500">{r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer">{r.series}</a> : r.series} · {r.frequency} · {r.status}</p></div><div className="text-right"><p className="text-gray-100">{r.latest ? `${r.latest.value.toFixed(2)}%` : 'Unavailable'}</p><time className="text-[10px] text-gray-500">{r.latest?.date || 'No observation'}</time></div></div>)}
      {data && 'differential' in data && <p className="text-gray-300">Observed base − quote rate: {data.differential == null ? 'Unavailable' : `${data.differential.toFixed(2)} percentage points`}</p>}
    </>}
    {kind === 'cot' && data?.reports?.[0] && <>
      <p className="text-cyan-300">{data.contract} · Report {data.reports[0].date}</p>
      <table className="w-full text-[11px]"><thead className="text-gray-500"><tr><th className="text-left">Group</th><th>Long</th><th>Short</th><th>Net</th></tr></thead><tbody>{data.reports[0].groups.map((g) => <tr key={g.label} className="border-t border-gray-700/50 text-gray-300"><td className="py-3">{g.label}</td>{[g.long,g.short,g.net].map((n,i) => <td key={i} className="text-right">{n.toLocaleString()}</td>)}</tr>)}</tbody></table>
    </>}
    {kind === 'sentiment' && data?.rows?.map((r) => <div key={r.window} className="flex justify-between border-b border-gray-700/40 py-3"><span className="text-gray-400">{r.window} completed trading bars</span><span className={(r.change_pct ?? 0)>=0 ? 'text-emerald-400' : 'text-red-400'}>{r.change_pct}%</span></div>)}
    {data?.as_of && <time className="text-[10px] text-gray-500">Latest completed price: {new Date(data.as_of).toLocaleDateString()}</time>}
    {data && <p className="text-[10px] text-gray-500 leading-relaxed">{data.note}</p>}
  </ResearchFrame>;
}
