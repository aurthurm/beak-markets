import type { ReactNode } from 'react';
import { buttonClass } from './styles';

export function ResearchFrame({ children, loading, error, refresh, source, fetchedAt }: {
  children: ReactNode; loading: boolean; error?: string; refresh: () => void; source?: string; fetchedAt?: string;
}) {
  return <div className="nodrag nowheel flex h-full min-h-0 flex-col gap-3 text-xs">
    <div className="flex items-center justify-between gap-2 shrink-0">
      <span className="text-[10px] text-gray-400">{loading ? 'Loading source data…' : source || 'Research data unavailable'}</span>
      <button className={buttonClass} onClick={refresh} disabled={loading}>Refresh</button>
    </div>
    {fetchedAt && <time className="text-[10px] text-gray-500 shrink-0" dateTime={fetchedAt}>Retrieved {new Date(fetchedAt).toLocaleString()}</time>}
    {error && <div role="alert" className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">{error}</div>}
    <div className="min-h-0 flex-1 overflow-y-auto space-y-3">{children}</div>
  </div>;
}
