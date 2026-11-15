import type { MarketDataset } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api').replace(/\/$/, '');

const cache = new Map<string, MarketDataset>();
const fetchedAt = new Map<string, number>();
const inFlight = new Map<string, Promise<MarketDataset>>();

const HARDCODED_PAIRS = [
  { ticker: 'EUR/USD', name: 'Euro / US Dollar', pipSize: 0.0001 },
  { ticker: 'GBP/USD', name: 'British Pound / US Dollar', pipSize: 0.0001 },
  { ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen', pipSize: 0.01 },
  { ticker: 'USD/CHF', name: 'US Dollar / Swiss Franc', pipSize: 0.0001 },
  { ticker: 'AUD/USD', name: 'Australian Dollar / US Dollar', pipSize: 0.0001 },
  { ticker: 'USD/CAD', name: 'US Dollar / Canadian Dollar', pipSize: 0.0001 },
  { ticker: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', pipSize: 0.0001 },
  { ticker: 'EUR/GBP', name: 'Euro / British Pound', pipSize: 0.0001 },
  { ticker: 'EUR/JPY', name: 'Euro / Japanese Yen', pipSize: 0.01 },
  { ticker: 'GBP/JPY', name: 'British Pound / Japanese Yen', pipSize: 0.01 },
  { ticker: 'AUD/JPY', name: 'Australian Dollar / Japanese Yen', pipSize: 0.01 },
  { ticker: 'EUR/CHF', name: 'Euro / Swiss Franc', pipSize: 0.0001 },
  { ticker: 'XAU/USD', name: 'Gold / US Dollar', pipSize: 0.1 },
  { ticker: 'DXY', name: 'US Dollar Index', pipSize: 0.01 },
];

export const marketService = {
  async getDataset(ticker: string, forceRefetch = false, days = 252): Promise<MarketDataset> {
    const cacheKey = `${ticker}:${days}`;
    if (!forceRefetch && cache.has(cacheKey) && Date.now() - (fetchedAt.get(cacheKey) ?? 0) < 300_000) {
      return cache.get(cacheKey)!;
    }

    const pending = inFlight.get(cacheKey);
    if (pending) return pending;
    const request = (async () => {
    const res = await fetch(`${API_BASE_URL}/market/dataset?ticker=${encodeURIComponent(ticker)}&days=${days}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      let errStr = `Failed to fetch data for ${ticker}`;
      try {
        const errData = await res.json();
        if (errData.detail) errStr = errData.detail;
      } catch { /* Preserve the fallback error if the response is not JSON. */ }
      throw new Error(errStr);
    }

    const dataset: MarketDataset = await res.json();
    if (dataset.ticker !== ticker || !Array.isArray(dataset.prices) || dataset.prices.length === 0 || dataset.prices.some((bar) => !Number.isFinite(bar.close) || bar.close <= 0)) throw new Error('Price response is empty or invalid');
    dataset.prices.sort((a, b) => a.timestamp - b.timestamp);
    cache.set(cacheKey, dataset);
    fetchedAt.set(cacheKey, Date.now());
    return dataset;
    })();
    inFlight.set(cacheKey, request);
    try { return await request; } finally { inFlight.delete(cacheKey); }

  },

  getAvailableTickers() {
    return HARDCODED_PAIRS;
  },

  getTickerDisplayInfo(ticker: string): { pipSize: number; decimals: number } {
    const pair = HARDCODED_PAIRS.find((p) => p.ticker === ticker);
    const pipSize = pair?.pipSize ?? (ticker.includes('JPY') ? 0.01 : 0.0001);
    const decimals = pipSize >= 0.1 ? 2 : pipSize >= 0.01 ? 3 : 5;
    return { pipSize, decimals };
  },

  async getLatestPrice(ticker: string, index?: number): Promise<number> {
    const ds = await this.getDataset(ticker);
    const idx = index ?? ds.prices.length - 1;
    const price = ds.prices[Math.min(Math.max(0, idx), ds.prices.length - 1)]?.close;
    if (!price || !Number.isFinite(price)) throw new Error("Price unavailable");
    return price;
  },

  calculateSMA(prices: number[], period: number): (number | null)[] {
    return prices.map((_, i) => {
      if (i < period - 1) return null;
      const slice = prices.slice(i - period + 1, i + 1);
      return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(6);
    });
  },

  calculateEMA(prices: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let ema: number | null = null;

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      if (ema === null) {
        ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      } else {
        ema = prices[i] * k + ema * (1 - k);
      }
      result.push(+ema.toFixed(6));
    }
    return result;
  },

  calculateRSI(prices: number[], period: number = 14): (number | null)[] {
    const result: (number | null)[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        result.push(null);
        continue;
      }
      const diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);

      if (i < period) {
        result.push(null);
        continue;
      }

      const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(+(100 - 100 / (1 + rs)).toFixed(2));
    }
    return result;
  },
};
