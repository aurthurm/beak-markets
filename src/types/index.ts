export type PriceBar = {
  ticker: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FinancialData = {
  revenue: number[];
  eps: number[];
  debt: number;
  margins: number;
  peRatio: number;
  pegRatio: number;
  dcfEstimate: number;
};

export type NewsItem = {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  summary: string;
};

export type COTPosition = {
  long: number;
  short: number;
  net: number; // long - short
  change: number; // change from prev week
};

export type YieldPoint = {
  tenor: string; // '2Y', '5Y', '10Y', '30Y'
  yield: number;
  change: number; // basis points
};

export type YieldsBondsData = {
  country: string;
  yields: YieldPoint[];
  realYield10Y: number; // TIPS / inflation-linked
  spread2s10s: number; // 10Y - 2Y (inversion indicator)
  history: { timestamp: number; y2: number; y10: number }[];
};

export type COTReport = {
  instrument: string;
  reportDate: number;
  openInterest: number;
  commercial: COTPosition;
  nonCommercial: COTPosition;
  nonReportable: COTPosition;
  history: { timestamp: number; netCommercial: number; netNonCommercial: number }[];
};

export type SentimentData = {
  ticker: string;
  overall: number; // -100 to 100
  breakdown: {
    label: string;
    value: number; // -100 to 100
  }[];
  signals: {
    label: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-100
  }[];
  history: { timestamp: number; value: number }[];
};

export type MarketDataset = {
  ticker: string;
  name: string;
  prices: PriceBar[];
  financials: FinancialData;
  earningsDates: number[];
  news: NewsItem[];
  sentiment: SentimentData;
  cot?: COTReport;
  yields?: YieldsBondsData;
};

export type WidgetType =
  | 'chart'
  | 'beakchart'
  | 'watchlist'
  | 'financials'
  | 'valuation'
  | 'interestRates'
  | 'alerts'
  | 'portfolio'
  | 'earnings'
  | 'news'
  | 'sentiment'
  | 'youtube'
  | 'cot'
  | 'yields'
  | 'ainews'
  | 'sticker';

export type Dashboard = {
  id: string;
  name: string;
};

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  ticker: string;
  syncTicker: boolean;
  locked?: boolean;
  settings: Record<string, unknown>;
  dashboardId?: string | null;
};

export type WidgetNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WidgetConfig;
  style?: { width: number; height: number };
};

export type Alert = {
  id: string;
  ticker: string;
  type: 'price_above' | 'price_below' | 'indicator_cross';
  value: number;
  triggered: boolean;
  createdAt: number;
};

export type Trade = {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
};

export type PortfolioPosition = {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
};

export const WIDGET_DEFAULTS: Record<
  WidgetType,
  { width: number; height: number; label: string; description: string }
> = {
  chart: { width: 620, height: 420, label: 'Candlestick Chart', description: 'OHLC candles, volume, indicators' },
  watchlist: { width: 300, height: 400, label: 'Watchlist', description: 'Track pairs and broadcast ticker' },
  financials: { width: 400, height: 350, label: 'Financials', description: 'GDP, rates, CPI, unemployment' },
  valuation: { width: 360, height: 300, label: 'Valuation', description: 'Rate differential, carry, inflation' },
  interestRates: { width: 400, height: 340, label: 'Interest Rates', description: 'Central bank rates, carry, history' },
  alerts: { width: 380, height: 350, label: 'Alerts', description: 'Price and indicator alerts' },
  portfolio: { width: 500, height: 400, label: 'Portfolio Sandbox', description: 'Mock trades, P&L, equity curve' },
  earnings: { width: 400, height: 320, label: 'Economic Calendar', description: 'Central bank dates, NFP, CPI' },
  news: { width: 420, height: 450, label: 'News Feed', description: 'Headlines per pair with sentiment' },
  sentiment: { width: 400, height: 420, label: 'Sentiment Analysis', description: 'Gauge, signals, history' },
  youtube: { width: 480, height: 360, label: 'YouTube Player', description: 'Embed videos' },
  cot: { width: 420, height: 420, label: 'Commitment of Traders', description: 'CFTC positioning: commercial, non-commercial, net' },
  yields: { width: 400, height: 360, label: 'Yields & Bonds', description: 'Treasury yields, yield curve, real yields' },
  ainews: { width: 440, height: 480, label: 'AI News & Research', description: 'AI summarizer and market researcher' },
  sticker: { width: 220, height: 200, label: 'NOTE', description: 'Write notes anywhere on the canvas' },
  beakchart: { width: 620, height: 420, label: 'BeakChart', description: 'Custom canvas chart with drawings' },
};
