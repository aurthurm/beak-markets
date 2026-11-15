export type BriefingSource = {
  id: string; url: string; headline: string; excerpt: string; source: string;
  kind: 'news' | 'official' | 'opinion' | 'economic_event'; published_at: number | null; currencies: string;
};
export type CitedPoint = { text: string; source_ids: string[] };
export type BriefingContent = {
  headline: string; overview: CitedPoint; risk_tone: string; sentiment_reason: CitedPoint;
  macro_drivers: CitedPoint[]; analyst_views: CitedPoint[]; counterarguments: CitedPoint[]; watch_next: CitedPoint[];
  trade_scenarios: { pair: string; direction: string; thesis: string; catalyst: string; confirmation: string; invalidation: string; risks: string; source_ids: string[] }[];
  coverage_limits: string;
};
export type SavedBriefing = {
  id: number; generated_at: number; model: string; sources_changed: boolean;
  content: BriefingContent; sources: BriefingSource[];
};
export type BriefingPeriod = {
  start: string; end: string; partial: boolean; future: boolean; as_of: number;
  item_count: number; source_count: number; kind_counts: Record<string, number>;
  items: BriefingSource[]; summary: SavedBriefing | null;
};
export type BriefingFeed = {
  periods: BriefingPeriod[]; local_today: string; timezone: string; scope: string;
  ai: { provider: string; configured: boolean; model: string; paid: boolean };
  archive_count: number; undated_count: number; note: string;
  feeds: { source: string; url: string; status: string; checked_at: number; item_count: number }[];
};

export async function briefingAction<T>(action: 'collect' | 'generate', body: unknown): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api').replace(/\/$/, '');
  const response = await fetch(`${base}/research/briefings/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(action === 'generate' ? 115_000 : 35_000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.detail === 'string' ? data.detail : `Briefing request failed (${response.status}).`);
  }
  return response.json();
}
