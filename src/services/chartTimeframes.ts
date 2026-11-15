import type { PriceBar } from '../types';

export type ChartTimeframe = 'D' | 'W' | 'M';

/** Aggregate only the observed bars passed in; callers cut off replay first. */
export function aggregateCandles(prices: PriceBar[], timeframe: ChartTimeframe): PriceBar[] {
  if (timeframe === 'D') return prices;
  const result: PriceBar[] = [];
  let previousKey = '';
  for (const bar of prices) {
    const day = new Date(bar.timestamp);
    if (timeframe === 'W') day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    else day.setUTCDate(1);
    day.setUTCHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    if (key !== previousKey) {
      result.push({ ...bar }); // Timestamp is the first observed session, never a fabricated session.
      previousKey = key;
    } else {
      const candle = result[result.length - 1];
      candle.high = Math.max(candle.high, bar.high);
      candle.low = Math.min(candle.low, bar.low);
      candle.close = bar.close;
      candle.volume += bar.volume;
    }
  }
  return result;
}
