import type { PriceBar, FinancialData, MarketDataset, NewsItem, SentimentData, COTReport, COTPosition, YieldsBondsData } from '../types';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Forex pairs have very different price ranges and pip sizes
const FOREX_PAIRS: { ticker: string; name: string; basePrice: number; pipSize: number }[] = [
  { ticker: 'EUR/USD', name: 'Euro / US Dollar', basePrice: 1.0850, pipSize: 0.0001 },
  { ticker: 'GBP/USD', name: 'British Pound / US Dollar', basePrice: 1.2650, pipSize: 0.0001 },
  { ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen', basePrice: 149.50, pipSize: 0.01 },
  { ticker: 'USD/CHF', name: 'US Dollar / Swiss Franc', basePrice: 0.8780, pipSize: 0.0001 },
  { ticker: 'AUD/USD', name: 'Australian Dollar / US Dollar', basePrice: 0.6520, pipSize: 0.0001 },
  { ticker: 'USD/CAD', name: 'US Dollar / Canadian Dollar', basePrice: 1.3580, pipSize: 0.0001 },
  { ticker: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', basePrice: 0.6120, pipSize: 0.0001 },
  { ticker: 'EUR/GBP', name: 'Euro / British Pound', basePrice: 0.8580, pipSize: 0.0001 },
  { ticker: 'EUR/JPY', name: 'Euro / Japanese Yen', basePrice: 162.20, pipSize: 0.01 },
  { ticker: 'GBP/JPY', name: 'British Pound / Japanese Yen', basePrice: 189.10, pipSize: 0.01 },
  { ticker: 'AUD/JPY', name: 'Australian Dollar / Japanese Yen', basePrice: 97.50, pipSize: 0.01 },
  { ticker: 'EUR/CHF', name: 'Euro / Swiss Franc', basePrice: 0.9530, pipSize: 0.0001 },
  { ticker: 'XAU/USD', name: 'Gold / US Dollar', basePrice: 2350.00, pipSize: 0.1 },
  { ticker: 'DXY', name: 'US Dollar Index', basePrice: 104.50, pipSize: 0.01 },
];

// Map ticker to CFTC COT instrument (base currency of pair)
const TICKER_TO_COT: Record<string, string> = {
  'EUR/USD': 'EUR', 'EUR/GBP': 'EUR', 'EUR/JPY': 'EUR', 'EUR/CHF': 'EUR',
  'GBP/USD': 'GBP', 'GBP/JPY': 'GBP',
  'USD/JPY': 'JPY', 'AUD/JPY': 'JPY',
  'USD/CHF': 'CHF',
  'AUD/USD': 'AUD',
  'USD/CAD': 'CAD',
  'NZD/USD': 'NZD',
  'XAU/USD': 'XAU',
  'DXY': 'USD',
};

export function generatePriceBars(ticker: string, days: number = 252, baseSeed?: number): PriceBar[] {
  const rand = seededRandom(baseSeed ?? ticker.charCodeAt(0) * 1000 + ticker.length * 73);
  const bars: PriceBar[] = [];
  const pair = FOREX_PAIRS.find((p) => p.ticker === ticker);
  let basePrice = pair?.basePrice ?? (0.5 + rand() * 1.5);
  const pipSize = pair?.pipSize ?? 0.0001;
  const decimals = pipSize < 0.001 ? 5 : 3;
  const now = Date.now();
  const dayMs = 86400000;

  for (let i = 0; i < days; i++) {
    const drift = (rand() - 0.48) * basePrice * 0.004;
    const open = basePrice + drift;
    const volatility = basePrice * 0.003 * (0.5 + rand());
    const high = open + rand() * volatility;
    const low = open - rand() * volatility;
    const close = low + rand() * (high - low);
    // Forex volume is simulated as lot volume in thousands
    const volume = Math.floor(50000 + rand() * 500000);

    bars.push({
      ticker,
      timestamp: now - (days - i) * dayMs,
      open: +open.toFixed(decimals),
      high: +high.toFixed(decimals),
      low: +low.toFixed(decimals),
      close: +close.toFixed(decimals),
      volume,
    });

    basePrice = close;
  }

  return bars;
}

export function generateFinancials(seed: number): FinancialData {
  const rand = seededRandom(seed);
  // For forex we repurpose these as macro indicators
  return {
    revenue: Array.from({ length: 8 }, (_, i) => +(1 + i * 0.3 + rand() * 2).toFixed(2)), // GDP growth %
    eps: Array.from({ length: 8 }, () => +(0.5 + rand() * 5).toFixed(2)), // Interest rate %
    debt: +(rand() * 120).toFixed(1), // Debt-to-GDP %
    margins: +(rand() * 6 - 1).toFixed(1), // CPI %
    peRatio: +(rand() * 8).toFixed(1), // Unemployment %
    pegRatio: +(-2 + rand() * 6).toFixed(2), // Trade balance (B)
    dcfEstimate: 0, // Not applicable for forex
  };
}

export function generateEarningsDates(count: number = 4): number[] {
  // For forex, these become central bank meeting dates
  const now = Date.now();
  const sixWeeksMs = 42 * 86400000;
  return Array.from({ length: count }, (_, i) => now + (i + 1) * sixWeeksMs - Math.random() * 5 * 86400000);
}

const NEWS_HEADLINES: Record<string, string[]> = {
  'EUR/USD': [
    'ECB Signals Cautious Approach on Rate Cuts Amid Sticky Inflation',
    'Eurozone PMI Beats Expectations, EUR Strengthens',
    'Fed Minutes Reveal Split on Timing of Next Rate Move',
    'US NFP Report Surprises to the Upside, Dollar Rallies',
    'German Industrial Output Falls Short of Forecasts',
    'EUR/USD Tests Key Resistance at 1.0900 Level',
    'ECB Lagarde: Inflation Progress Encouraging but Premature to Declare Victory',
    'US CPI Data Comes in Hot, Rate Cut Expectations Shift',
  ],
  'GBP/USD': [
    'BoE Holds Rates Steady, Signals Data-Dependent Path Forward',
    'UK Retail Sales Rebound Sharply in Latest Report',
    'Cable Tests 1.2700 as Dollar Weakens Broadly',
    'UK Inflation Drops Below BoE Target for First Time',
    'GBP Pressured by Weak UK GDP Print',
    'BoE Bailey: More Confident Inflation is Heading in Right Direction',
  ],
  'XAU/USD': [
    'Gold Hits Record High on Safe-Haven Demand',
    'Fed Rate Expectations Weigh on Gold Rally',
    'Central Bank Buying Supports Gold Prices',
    'Inflation Hedge Demand Drives Gold Higher',
    'Gold Consolidates Near Key Resistance Level',
    'Geopolitical Tensions Boost Safe-Haven Appeal',
  ],
  'DXY': [
    'Dollar Index Rallies on Strong US Employment Data',
    'Fed Hawkish Stance Supports Dollar Strength',
    'DXY Tests Key Resistance at 105 Level',
    'Dollar Weakens as Rate Cut Expectations Build',
    'Safe-Haven Flows Lift US Dollar Index',
    'Trade-Weighted Dollar at Monthly Highs',
  ],
  'USD/JPY': [
    'BoJ Intervenes as Yen Weakens Past 150 Level',
    'Japan Core CPI Holds Above Target, BoJ Under Pressure',
    'USD/JPY Surges to Multi-Decade High on Rate Divergence',
    'Japanese Finance Minister Issues Verbal Warning on Yen Weakness',
    'BoJ Ueda Hints at Policy Normalization Timeline',
    'Carry Trade Unwind Sends Yen Sharply Higher',
  ],
  default: [
    'Central Bank Rate Decision Drives Volatility in FX Markets',
    'Risk Sentiment Shifts as Geopolitical Tensions Escalate',
    'Commodity Currencies Under Pressure on China Slowdown Fears',
    'Safe Haven Demand Boosts Franc and Yen',
    'FX Volatility Spikes Ahead of Key Economic Data Releases',
    'Dollar Index Trades at Monthly Highs on Strong US Data',
    'Emerging Market Currencies Face Headwinds from Strong Dollar',
    'G7 Finance Ministers Discuss Currency Market Stability',
  ],
};

const NEWS_SOURCES = ['Reuters', 'Bloomberg', 'FX Street', 'ForexLive', 'DailyFX', 'Investing.com', 'CNBC', 'Financial Times'];

function generateNews(ticker: string, seed: number): NewsItem[] {
  const rand = seededRandom(seed);
  const headlines = NEWS_HEADLINES[ticker] ?? NEWS_HEADLINES['default'];
  const now = Date.now();
  const dayMs = 86400000;

  return Array.from({ length: 12 }, (_, i) => {
    const sentiments: NewsItem['sentiment'][] = ['bullish', 'bearish', 'neutral'];
    const impacts: NewsItem['impact'][] = ['high', 'medium', 'low'];
    const headline = headlines[Math.floor(rand() * headlines.length)];
    const sentiment = sentiments[Math.floor(rand() * 3)];

    return {
      id: `${ticker}-news-${i}`,
      ticker,
      headline,
      source: NEWS_SOURCES[Math.floor(rand() * NEWS_SOURCES.length)],
      timestamp: now - Math.floor(rand() * 14) * dayMs - Math.floor(rand() * 12) * 3600000,
      sentiment,
      impact: impacts[Math.floor(rand() * 3)],
      summary: `Market analysis suggests ${sentiment} outlook for ${ticker}. Traders are closely watching upcoming economic data and central bank commentary for further direction.`,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

function generateSentiment(ticker: string, seed: number): SentimentData {
  const rand = seededRandom(seed);
  const overall = Math.floor((rand() - 0.4) * 120);
  const now = Date.now();
  const dayMs = 86400000;

  return {
    ticker,
    overall: Math.max(-100, Math.min(100, overall)),
    breakdown: [
      { label: 'Technical', value: Math.floor((rand() - 0.4) * 140) },
      { label: 'Fundamental', value: Math.floor((rand() - 0.45) * 130) },
      { label: 'Positioning', value: Math.floor((rand() - 0.5) * 120) },
      { label: 'Flow', value: Math.floor((rand() - 0.4) * 110) },
      { label: 'Retail Sentiment', value: Math.floor((rand() - 0.55) * 150) },
    ].map((b) => ({ ...b, value: Math.max(-100, Math.min(100, b.value)) })),
    signals: [
      { label: 'Moving Avg Cross', direction: rand() > 0.5 ? 'bullish' : 'bearish' as const, strength: Math.floor(40 + rand() * 60) },
      { label: 'RSI Divergence', direction: rand() > 0.6 ? 'bullish' : rand() > 0.3 ? 'bearish' : 'neutral' as const, strength: Math.floor(30 + rand() * 70) },
      { label: 'MACD Signal', direction: rand() > 0.45 ? 'bullish' : 'bearish' as const, strength: Math.floor(50 + rand() * 50) },
      { label: 'COT Report', direction: rand() > 0.5 ? 'bullish' : rand() > 0.3 ? 'bearish' : 'neutral' as const, strength: Math.floor(20 + rand() * 80) },
      { label: 'Volatility Skew', direction: rand() > 0.4 ? 'bearish' : 'bullish' as const, strength: Math.floor(35 + rand() * 65) },
      { label: 'Order Flow', direction: rand() > 0.5 ? 'bullish' : 'bearish' as const, strength: Math.floor(45 + rand() * 55) },
    ],
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: now - (30 - i) * dayMs,
      value: Math.max(-100, Math.min(100, overall + Math.floor((rand() - 0.5) * 40))),
    })),
  };
}

export function getAllStocks() {
  return FOREX_PAIRS.map((p) => ({ ticker: p.ticker, name: p.name, pipSize: p.pipSize }));
}

function generateCOTPosition(rand: () => number, scale: number): COTPosition {
  const long = Math.floor(scale * (0.3 + rand() * 0.5));
  const short = Math.floor(scale * (0.3 + rand() * 0.5));
  const net = long - short;
  const change = Math.floor((rand() - 0.5) * scale * 0.15);
  return { long, short, net, change };
}

export function generateCOT(ticker: string, seed: number): COTReport {
  const rand = seededRandom(seed);
  const instrument = TICKER_TO_COT[ticker] ?? ticker.split('/')[0] ?? ticker;
  const now = Date.now();
  const weekMs = 7 * 86400000;

  // Latest report (CFTC reports weekly, typically Tuesday)
  const reportDate = now - (Math.floor(rand() * 3) * 86400000);
  const scale = 50000 + rand() * 150000;

  const commercial = generateCOTPosition(rand, scale * 0.6);
  const nonCommercial = generateCOTPosition(rand, scale * 0.5);
  const nonReportable = generateCOTPosition(rand, scale * 0.15);

  const openInterest = Math.floor(scale * (1.2 + rand() * 0.5));

  // 12 weeks of history for chart (oldest first, ending at current)
  const commValues: number[] = [commercial.net];
  const ncValues: number[] = [nonCommercial.net];
  for (let i = 1; i < 12; i++) {
    commValues.unshift(commValues[0] - Math.floor((rand() - 0.5) * scale * 0.06));
    ncValues.unshift(ncValues[0] - Math.floor((rand() - 0.48) * scale * 0.08));
  }
  const history: COTReport['history'] = commValues.map((netCommercial, i) => ({
    timestamp: now - (11 - i) * weekMs,
    netCommercial,
    netNonCommercial: ncValues[i],
  }));

  return {
    instrument,
    reportDate,
    openInterest,
    commercial,
    nonCommercial,
    nonReportable,
    history,
  };
}

// Map ticker to country for yields (base currency of pair)
const TICKER_TO_YIELDS_COUNTRY: Record<string, string> = {
  'EUR/USD': 'US', 'GBP/USD': 'US', 'USD/JPY': 'US', 'USD/CHF': 'US',
  'AUD/USD': 'US', 'USD/CAD': 'US', 'NZD/USD': 'US',
  'EUR/GBP': 'UK', 'EUR/JPY': 'EU', 'GBP/JPY': 'UK', 'AUD/JPY': 'AU',
  'EUR/CHF': 'EU', 'XAU/USD': 'US', 'DXY': 'US',
};

export function generateYields(ticker: string, seed: number): YieldsBondsData {
  const rand = seededRandom(seed);
  const country = TICKER_TO_YIELDS_COUNTRY[ticker] ?? 'US';
  const now = Date.now();
  const dayMs = 86400000;

  // Base yields: 2Y, 5Y, 10Y, 30Y (typical ranges)
  const base2Y = 4.0 + rand() * 1.5;
  const base5Y = 4.1 + rand() * 1.2;
  const base10Y = 4.2 + rand() * 1.0;
  const base30Y = 4.3 + rand() * 0.8;

  // change in basis points (1 bp = 0.01%)
  const yields = [
    { tenor: '2Y', yield: base2Y, change: Math.round((rand() * 20 - 10)) },
    { tenor: '5Y', yield: base5Y, change: Math.round((rand() * 18 - 9)) },
    { tenor: '10Y', yield: base10Y, change: Math.round((rand() * 15 - 8)) },
    { tenor: '30Y', yield: base30Y, change: Math.round((rand() * 12 - 6)) },
  ];

  const spread2s10s = +(base10Y - base2Y).toFixed(2);
  const inflation = 2.0 + rand() * 2;
  const realYield10Y = +(base10Y - inflation).toFixed(2);

  const history: YieldsBondsData['history'] = Array.from({ length: 30 }, (_, i) => ({
    timestamp: now - (30 - i) * dayMs,
    y2: +(base2Y + (rand() - 0.5) * 0.3).toFixed(2),
    y10: +(base10Y + (rand() - 0.5) * 0.25).toFixed(2),
  }));

  return {
    country,
    yields,
    realYield10Y,
    spread2s10s,
    history,
  };
}

export function getMarketDataset(ticker: string): MarketDataset {
  const pair = FOREX_PAIRS.find((p) => p.ticker === ticker) ?? { ticker, name: ticker };
  const seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 137;
  return {
    ticker: pair.ticker,
    name: pair.name,
    prices: generatePriceBars(pair.ticker, 252, seed),
    financials: generateFinancials(seed + 999),
    earningsDates: generateEarningsDates(4),
    news: generateNews(pair.ticker, seed + 555),
    sentiment: generateSentiment(pair.ticker, seed + 777),
    cot: generateCOT(pair.ticker, seed + 333),
    yields: generateYields(pair.ticker, seed + 111),
  };
}
