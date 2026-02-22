import { getMarketDataset, getAllStocks } from '../mock-data/generators';
import type { MarketDataset } from '../types';

const cache = new Map<string, MarketDataset>();

export const marketService = {
  getDataset(ticker: string): MarketDataset {
    if (!cache.has(ticker)) {
      cache.set(ticker, getMarketDataset(ticker));
    }
    return cache.get(ticker)!;
  },

  getAvailableTickers() {
    return getAllStocks();
  },

  getTickerDisplayInfo(ticker: string): { pipSize: number; decimals: number } {
    const pairs = getAllStocks();
    const pair = pairs.find((p) => p.ticker === ticker);
    const pipSize = pair?.pipSize ?? (ticker.includes('JPY') ? 0.01 : 0.0001);
    const decimals = pipSize >= 0.1 ? 2 : pipSize >= 0.01 ? 3 : 5;
    return { pipSize, decimals };
  },

  getLatestPrice(ticker: string, index?: number): number {
    const ds = this.getDataset(ticker);
    const idx = index ?? ds.prices.length - 1;
    return ds.prices[idx]?.close ?? 0;
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
