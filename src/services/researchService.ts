type BackendAnalysis = {
 stance: 'bullish' | 'bearish' | 'neutral'; confidence: number; headline: string;
 divergence_notes: string; article_count: number; generated_at: string;
 drivers: { claim: string; source: string; source_url: string }[];
 counterpoints: { claim: string; source: string; source_url: string }[];
};

export type ResearchBoard = {
  checked_at: string;
  source: string;
  rows: { ticker: string; status: 'available' | 'stale' | 'missing' | 'unavailable'; analysis: BackendAnalysis | null }[];
};

export type CalendarFeed = {
  source: string; source_url: string; fetched_at: string; note: string;
  events: {
    id: string; country: string; title: string; timestamp: number; time_known: boolean;
    impact: 'high' | 'medium' | 'low'; actual: string | null;
    forecast: string | null; previous: string | null; surprise: number | null;
  }[];
};

export type LiquidityScan = {
  ticker: string; source: string; source_url: string; fetched_at: string;
  as_of: number | null; bars_used: number; lookback: number; note: string;
  status: 'available' | 'insufficient';
  signals: { timestamp: number; side: 'high' | 'low'; level: number; close: number; outcome: 'rejection' | 'breakout' }[];
};

export function safeSource(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch { return undefined; }
}

export async function researchRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api').replace(/\/$/, '');
  const res = await fetch(`${base}/research/${path}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Research request failed (${res.status}).`);
  }
  return res.json();
}
