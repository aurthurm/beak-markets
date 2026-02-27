import { useEffect, useMemo, useState } from 'react';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';
import type { NewsItem, MarketDataset } from '../../types';

type Props = { ticker: string };

const SENTIMENT_STYLES = {
  bullish: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  bearish: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
  neutral: { bg: 'bg-gray-500/10', border: 'border-gray-600/30', text: 'text-gray-400', dot: 'bg-gray-400' },
};

const IMPACT_STYLES = {
  high: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  medium: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  low: 'text-gray-500 bg-gray-700/30 border-gray-600/20',
};

export default function NewsWidget({ ticker }: Props) {
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | NewsItem['sentiment']>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketService.getDataset(ticker).then((ds) => {
      if (active) setDataset(ds);
    }).catch((err) => { if (active) setError(err.message || 'Error loading data'); });
    return () => { active = false; };
  }, [ticker]);

  const news = useMemo(() => {
    if (!dataset) return [];
    if (filter === 'all') return dataset.news;
    return dataset.news.filter((n) => n.sentiment === filter);
  }, [dataset, filter]);

  const sentimentCounts = useMemo(() => {
    const counts = { bullish: 0, bearish: 0, neutral: 0 };
    if (!dataset) return counts;
    dataset.news.forEach((n) => counts[n.sentiment]++);
    return counts;
  }, [dataset]);

  const timeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1d ago' : `${days}d ago`;
  };

  return (
    <div className="flex flex-col h-full gap-2.5">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-400">{error}</span>
          </div>
        </div>
      )}
      {(!dataset) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10 backdrop-blur-sm rounded-lg">
          <span className="text-xs text-gray-400">Loading news...</span>
        </div>
      )}
      {/* Header bar with sentiment summary */}
      <div className="nodrag flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-mono text-emerald-400">{sentimentCounts.bullish}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 rounded border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-[10px] font-mono text-red-400">{sentimentCounts.bearish}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-500/10 rounded border border-gray-600/20">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <span className="text-[10px] font-mono text-gray-400">{sentimentCounts.neutral}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="nodrag flex gap-1">
        {(['all', 'bullish', 'bearish', 'neutral'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border capitalize ${filter === f
                ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* News list */}
      <div className="nodrag flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {news.map((item) => {
          const style = SENTIMENT_STYLES[item.sentiment];
          const isExpanded = expandedId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className={`w-full text-left rounded-lg p-2.5 border transition-colors ${style.bg} ${style.border} hover:brightness-110`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white leading-snug line-clamp-2">
                    {item.headline}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500">{item.source}</span>
                    <span className="text-[10px] text-gray-600">{timeAgo(item.timestamp)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono rounded border uppercase ${style.text} ${style.bg} ${style.border}`}>
                    <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                    {item.sentiment}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border uppercase ${IMPACT_STYLES[item.impact]}`}>
                    {item.impact}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-700/30">
                  <p className="text-[11px] text-gray-400 leading-relaxed">{item.summary}</p>
                  <div className="text-[10px] text-gray-600 mt-1">{formatDate(item.timestamp)}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
