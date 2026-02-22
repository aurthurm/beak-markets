import { useMemo, useState } from 'react';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';
import type { NewsItem } from '../../types';

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
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const [filter, setFilter] = useState<'all' | NewsItem['sentiment']>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const news = useMemo(() => {
    if (filter === 'all') return dataset.news;
    return dataset.news.filter((n) => n.sentiment === filter);
  }, [dataset.news, filter]);

  const sentimentCounts = useMemo(() => {
    const counts = { bullish: 0, bearish: 0, neutral: 0 };
    dataset.news.forEach((n) => counts[n.sentiment]++);
    return counts;
  }, [dataset.news]);

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
            className={`px-2 py-0.5 text-[10px] font-mono rounded border capitalize ${
              filter === f
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
