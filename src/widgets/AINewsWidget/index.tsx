import { useMemo, useState } from 'react';
import { marketService } from '../../services/marketService';
import { aiService } from '../../services/aiService';
import AISettingsModal from './AISettingsModal';

type Props = { ticker: string };

const CATEGORY_LABELS: Record<string, string> = {
  outlook: 'Outlook',
  levels: 'Key Levels',
  catalysts: 'Catalysts',
  risks: 'Risks',
  correlations: 'Correlations',
};

const CATEGORY_COLORS: Record<string, string> = {
  outlook: 'border-cyan-500/40 bg-cyan-500/5',
  levels: 'border-amber-500/40 bg-amber-500/5',
  catalysts: 'border-emerald-500/40 bg-emerald-500/5',
  risks: 'border-red-500/40 bg-red-500/5',
  correlations: 'border-violet-500/40 bg-violet-500/5',
};

export default function AINewsWidget({ ticker }: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'research'>('summary');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const summary = useMemo(
    () => aiService.getNewsSummary(ticker, dataset.news, dataset.sentiment),
    [ticker, dataset.news, dataset.sentiment]
  );
  const research = useMemo(
    () => aiService.getResearchReport(ticker, dataset.news, dataset.sentiment),
    [ticker, dataset.news, dataset.sentiment]
  );

  const biasColor =
    summary.sentimentBias === 'bullish'
      ? 'text-emerald-400'
      : summary.sentimentBias === 'bearish'
        ? 'text-red-400'
        : 'text-gray-400';

  return (
    <div className="flex flex-col h-full gap-3">
      {/* AI badge + settings */}
      <div className="nodrag flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-violet-400"
          >
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z" />
          </svg>
          <span className="text-[10px] font-semibold text-violet-300">AI Summary & Research</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 transition-colors"
          title="AI Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <AISettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Tabs */}
      <div className="nodrag flex gap-1">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
            activeTab === 'summary'
              ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
              : 'border-gray-700 text-gray-500 hover:text-gray-300'
          }`}
        >
          News Summary
        </button>
        <button
          onClick={() => setActiveTab('research')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
            activeTab === 'research'
              ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
              : 'border-gray-700 text-gray-500 hover:text-gray-300'
          }`}
        >
          Research
        </button>
      </div>

      {activeTab === 'summary' ? (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
          {/* Summary card */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                AI News Summary
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono capitalize ${biasColor}`}>
                  {summary.sentimentBias}
                </span>
                <span className="text-[10px] text-gray-500">{summary.confidence}% confidence</span>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{summary.summary}</p>
          </div>

          {/* Key themes */}
          {summary.keyThemes.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                Key Themes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summary.keyThemes.map((theme) => (
                  <span
                    key={theme}
                    className="px-2 py-1 text-[10px] rounded-md bg-gray-800/60 border border-gray-700/50 text-gray-400"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
          {/* Overall outlook */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-cyan-500/20">
            <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider mb-1.5">
              Overall Outlook
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{research.overallOutlook}</p>
          </div>

          {/* Research insights */}
          <div className="space-y-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Research Insights
            </div>
            {research.insights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-lg p-2.5 border ${CATEGORY_COLORS[insight.category] ?? 'border-gray-700/50 bg-gray-800/30'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-white">
                    {CATEGORY_LABELS[insight.category] ?? insight.title}
                  </span>
                  <span className="text-[9px] text-gray-500">{insight.relevance}% relevance</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{insight.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
