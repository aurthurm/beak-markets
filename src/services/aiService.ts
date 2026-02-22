import type { NewsItem, SentimentData } from '../types';

export type AINewsSummary = {
  ticker: string;
  summary: string;
  keyThemes: string[];
  sentimentBias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  generatedAt: number;
};

export type AIResearchInsight = {
  id: string;
  title: string;
  content: string;
  category: 'outlook' | 'levels' | 'catalysts' | 'risks' | 'correlations';
  relevance: number; // 0-100
};

export type AIResearchReport = {
  ticker: string;
  insights: AIResearchInsight[];
  overallOutlook: string;
  generatedAt: number;
};

// Deterministic "AI" output from news + sentiment (mock; swap for real API later)

function buildSummary(news: NewsItem[], sentiment: SentimentData, ticker: string): AINewsSummary {
  const bull = news.filter((n) => n.sentiment === 'bullish').length;
  const bear = news.filter((n) => n.sentiment === 'bearish').length;
  const highImpact = news.filter((n) => n.impact === 'high').length;

  const headlines = news.slice(0, 5).map((n) => n.headline);
  const themes = extractThemes(headlines);
  const bias = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'neutral';
  const confidence = Math.min(95, 50 + Math.abs(bull - bear) * 4 + highImpact * 5);

  const summaryParts: string[] = [];
  summaryParts.push(
    `Across ${news.length} recent articles, sentiment skews ${bias} (${bull} bullish, ${bear} bearish).`
  );
  if (themes.length > 0) {
    summaryParts.push(`Key themes: ${themes.slice(0, 3).join('; ')}.`);
  }
  if (highImpact > 0) {
    summaryParts.push(`${highImpact} high-impact headlines suggest heightened volatility.`);
  }
  summaryParts.push(
    `Overall positioning signal aligns ${sentiment.overall >= 20 ? 'bullish' : sentiment.overall <= -20 ? 'bearish' : 'neutral'} with a score of ${sentiment.overall}.`
  );

  return {
    ticker,
    summary: summaryParts.join(' '),
    keyThemes: themes,
    sentimentBias: bias,
    confidence,
    generatedAt: Date.now(),
  };
}

function extractThemes(headlines: string[]): string[] {
  const themeMap: Record<string, string> = {
    rate: 'Central bank rate expectations',
    fed: 'Fed policy path',
    ecb: 'ECB / Eurozone policy',
    boe: 'BoE / UK policy',
    boj: 'BoJ / Japan policy',
    inflation: 'Inflation dynamics',
    employment: 'Labor market data',
    intervention: 'FX intervention risk',
    carry: 'Carry trade flows',
    safe: 'Safe-haven demand',
    volatility: 'Volatility regime',
    resistance: 'Technical levels',
    data: 'Upcoming economic data',
    geopolitic: 'Geopolitical factors',
    dollar: 'Dollar strength/weakness',
    gold: 'Gold / precious metals',
  };

  const found = new Set<string>();
  const text = headlines.join(' ').toLowerCase();
  for (const [key, label] of Object.entries(themeMap)) {
    if (text.includes(key) && !found.has(label)) {
      found.add(label);
    }
  }
  if (found.size === 0) {
    return ['Macro policy divergence', 'Risk sentiment', 'Technical positioning'];
  }
  return Array.from(found);
}

function buildResearchReport(
  ticker: string,
  news: NewsItem[],
  sentiment: SentimentData
): AIResearchReport {
  const themes = extractThemes(news.map((n) => n.headline));
  const outlook =
    sentiment.overall >= 30
      ? `Near-term bias remains constructive. Watch for follow-through on recent price action and confirmation from upcoming data.`
      : sentiment.overall <= -30
        ? `Positioning suggests crowded short sentiment. Contrarian setups may emerge on reversals.`
        : `Key drivers: ${themes[0] ?? 'macro policy'}, ${themes[1] ?? 'risk sentiment'}. Monitor central bank rhetoric and high-impact data releases.`;

  const insights: AIResearchInsight[] = [
    {
      id: 'outlook-1',
      title: 'Market Outlook',
      content: outlook,
      category: 'outlook',
      relevance: 90,
    },
    {
      id: 'levels-1',
      title: 'Key Levels',
      content: `Technical structure suggests watching recent swing highs/lows. RSI at ${Math.abs(sentiment.overall) + 35} zone. Consider support/resistance from recent consolidation.`,
      category: 'levels',
      relevance: 75,
    },
    {
      id: 'catalysts-1',
      title: 'Near-Term Catalysts',
      content: `Upcoming central bank meetings and economic data (NFP, CPI, PMI) likely to drive volatility. ${news.some((n) => n.impact === 'high') ? 'High-impact headlines in the feed warrant attention.' : 'Monitor news flow for surprise catalysts.'}`,
      category: 'catalysts',
      relevance: 85,
    },
    {
      id: 'risks-1',
      title: 'Risks',
      content: `Positioning extremes (COT, retail) suggest ${sentiment.overall > 50 ? 'potential for long squeeze' : sentiment.overall < -50 ? 'potential for short squeeze' : 'balanced risk'}. Geopolitical and policy surprises remain tail risks.`,
      category: 'risks',
      relevance: 70,
    },
    {
      id: 'corr-1',
      title: 'Correlations',
      content: `Correlation with DXY and risk assets (equities, commodities) remains relevant. ${ticker.includes('JPY') ? 'USD/JPY sensitive to Treasury yields and BoJ policy.' : ticker.includes('XAU') ? 'Gold inversely correlated with real yields and dollar.' : 'Cross-pair flows (EUR, GBP) may influence direction.'}`,
      category: 'correlations',
      relevance: 65,
    },
  ];

  const overallOutlook =
    sentiment.overall >= 30
      ? `Bullish bias for ${ticker}. Sentiment and positioning support upside. Consider dips as potential entries.`
      : sentiment.overall <= -30
        ? `Bearish bias for ${ticker}. Sentiment and positioning favor downside. Rallies may offer short opportunities.`
        : `Neutral for ${ticker}. Mixed signals suggest range-bound trading. Focus on key levels and catalysts.`;

  return {
    ticker,
    insights,
    overallOutlook,
    generatedAt: Date.now(),
  };
}

export const aiService = {
  getNewsSummary(ticker: string, news: NewsItem[], sentiment: SentimentData): AINewsSummary {
    return buildSummary(news, sentiment, ticker);
  },

  getResearchReport(ticker: string, news: NewsItem[], sentiment: SentimentData): AIResearchReport {
    return buildResearchReport(ticker, news, sentiment);
  },
};
