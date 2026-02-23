import type { LineDataPoint } from '../types.ts';
import type {
  IndicatorConfig,
  IndicatorSource,
  BottomIndicatorData,
  FractalPoint,
  PriceBar,
} from './types.ts';

// ── Source ────────────────────────────────────────────────────────────────────

export function getSourcePrice(p: PriceBar, source: IndicatorSource): number {
  if (source === 'median') return (p.high + p.low) / 2;
  if (source === 'open')   return p.open;
  if (source === 'high')   return p.high;
  if (source === 'low')    return p.low;
  return p.close;
}

// ── Moving averages ───────────────────────────────────────────────────────────

export function computeSmaValues(values: number[], period: number): Array<number | null> {
  let rolling = 0;
  return values.map((v, i) => {
    rolling += v;
    if (i >= period) rolling -= values[i - period]!;
    if (i < period - 1) return null;
    return rolling / period;
  });
}

export function computeEmaValues(values: number[], period: number): Array<number | null> {
  if (values.length === 0) return [];
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;
  return values.map((v, i) => {
    if (i < period - 1) { seedSum += v; return null; }
    if (i === period - 1) { seedSum += v; ema = seedSum / period; return ema; }
    ema = (v - ema!) * alpha + ema!;
    return ema;
  });
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────

export function computeBBValues(
  prices: PriceBar[],
  indicator: Pick<IndicatorConfig, 'period' | 'source' | 'bbStdDev'>,
): { upper: LineDataPoint[]; middle: LineDataPoint[]; lower: LineDataPoint[] } {
  const period = indicator.period;
  const mult   = indicator.bbStdDev ?? 2;
  const source = prices.map(p => getSourcePrice(p, indicator.source));
  const sma    = computeSmaValues(source, period);

  const upper: LineDataPoint[]  = [];
  const middle: LineDataPoint[] = [];
  const lower: LineDataPoint[]  = [];

  for (let i = 0; i < prices.length; i++) {
    const time = prices[i]!.time;
    const mid  = sma[i];
    if (mid == null) {
      upper.push({ time, value: null });
      middle.push({ time, value: null });
      lower.push({ time, value: null });
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = source[j]! - mid;
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);
    upper.push({ time, value: mid + mult * sd });
    middle.push({ time, value: mid });
    lower.push({ time, value: mid - mult * sd });
  }

  return { upper, middle, lower };
}

// ── ATR (Wilder's smoothing) ──────────────────────────────────────────────────

export function computeAtrValues(prices: PriceBar[], period: number): Array<number | null> {
  if (prices.length === 0) return [];
  const result: Array<number | null> = [null];
  let atr: number | null = null;
  let sumTr = 0;

  for (let i = 1; i < prices.length; i++) {
    const { high, low } = prices[i]!;
    const prevClose = prices[i - 1]!.close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    if (i < period) { sumTr += tr; result.push(null); continue; }
    if (i === period) { sumTr += tr; atr = sumTr / period; }
    else { atr = (atr! * (period - 1) + tr) / period; }
    result.push(atr);
  }
  return result;
}

// ── RSI ───────────────────────────────────────────────────────────────────────

export function computeRsiValues(prices: PriceBar[], period: number): Array<number | null> {
  if (prices.length === 0) return [];
  const result: Array<number | null> = [null];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i]!.close - prices[i - 1]!.close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    if (i < period) { avgGain += gain; avgLoss += loss; result.push(null); continue; }
    if (i === period) {
      avgGain = (avgGain + gain) / period;
      avgLoss = (avgLoss + loss) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// ── MACD ──────────────────────────────────────────────────────────────────────

export function computeMacdValues(
  prices: PriceBar[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macdLine: Array<number | null>; signalLine: Array<number | null>; histogram: Array<number | null> } {
  const closes  = prices.map(p => p.close);
  const fastEma = computeEmaValues(closes, fastPeriod);
  const slowEma = computeEmaValues(closes, slowPeriod);

  const macdLine: Array<number | null> = closes.map((_, i) => {
    const f = fastEma[i]; const s = slowEma[i];
    if (f == null || s == null) return null;
    return f - s;
  });

  const macdNonNull = macdLine.filter((v): v is number => v != null);
  const signalRaw   = computeEmaValues(macdNonNull, signalPeriod);
  const signalLine: Array<number | null> = [];
  let si = 0;
  for (const v of macdLine) {
    if (v == null) { signalLine.push(null); } else { signalLine.push(signalRaw[si] ?? null); si++; }
  }

  const histogram: Array<number | null> = macdLine.map((m, i) => {
    const s = signalLine[i];
    if (m == null || s == null) return null;
    return m - s;
  });

  return { macdLine, signalLine, histogram };
}

// ── Awesome Oscillator ────────────────────────────────────────────────────────

export function computeAoValues(prices: PriceBar[]): Array<number | null> {
  const medians = prices.map(p => (p.high + p.low) / 2);
  const sma5    = computeSmaValues(medians, 5);
  const sma34   = computeSmaValues(medians, 34);
  return medians.map((_, i) => {
    const fast = sma5[i]; const slow = sma34[i];
    if (fast == null || slow == null) return null;
    return fast - slow;
  });
}

// ── Williams Fractals (5-bar) ─────────────────────────────────────────────────

export function computeFractals(prices: PriceBar[]): { up: FractalPoint[]; down: FractalPoint[] } {
  const up: FractalPoint[]   = [];
  const down: FractalPoint[] = [];

  for (let i = 2; i < prices.length - 2; i++) {
    const h = prices[i]!.high;
    const l = prices[i]!.low;
    if (h > prices[i - 2]!.high && h > prices[i - 1]!.high &&
        h > prices[i + 1]!.high && h > prices[i + 2]!.high) {
      up.push({ barIndex: i, price: h });
    }
    if (l < prices[i - 2]!.low && l < prices[i - 1]!.low &&
        l < prices[i + 1]!.low && l < prices[i + 2]!.low) {
      down.push({ barIndex: i, price: l });
    }
  }

  return { up, down };
}

// ── Orchestrators ─────────────────────────────────────────────────────────────

export function computeIndicatorData(prices: PriceBar[], indicator: IndicatorConfig): LineDataPoint[] {
  if (indicator.type === 'bb')       return computeBBValues(prices, indicator).middle;
  if (indicator.type === 'volume')   return prices.map(p => ({ time: p.time, value: p.volume ?? null }));
  if (indicator.type === 'fractals') return prices.map(p => ({ time: p.time, value: null }));

  let base: Array<number | null>;
  if (indicator.type === 'rsi') {
    base = computeRsiValues(prices, indicator.period);
  } else if (indicator.type === 'atr') {
    base = computeAtrValues(prices, indicator.period);
  } else if (indicator.type === 'macd') {
    base = computeMacdValues(prices, indicator.fastPeriod ?? 12, indicator.slowPeriod ?? 26, indicator.signalPeriod ?? 9).macdLine;
  } else if (indicator.type === 'ao') {
    base = computeAoValues(prices);
  } else {
    const sourceValues = prices.map(p => getSourcePrice(p, indicator.source));
    base = indicator.type === 'ema'
      ? computeEmaValues(sourceValues, indicator.period)
      : computeSmaValues(sourceValues, indicator.period);
  }

  return prices.map((p, i) => {
    const shiftedIndex = i - indicator.offset;
    if (shiftedIndex < 0 || shiftedIndex >= base.length) return { time: p.time, value: null };
    return { time: p.time, value: base[shiftedIndex] };
  });
}

export function computeBottomPanelData(prices: PriceBar[], indicator: IndicatorConfig): BottomIndicatorData {
  if (indicator.type === 'rsi') {
    const values = computeRsiValues(prices, indicator.period);
    const ob = indicator.overbought ?? 70;
    const os = indicator.oversold  ?? 30;
    return {
      lines: [{ label: `RSI ${indicator.period}`, color: indicator.color, values }],
      referenceLines: [
        { value: ob, color: '#ef4444aa', dashed: true },
        { value: os, color: '#22c55eaa', dashed: true },
        { value: 50, color: '#94a3b844', dashed: true },
      ],
      yRange: { min: 0, max: 100 },
    };
  }

  if (indicator.type === 'macd') {
    const fast = indicator.fastPeriod   ?? 12;
    const slow = indicator.slowPeriod   ?? 26;
    const sig  = indicator.signalPeriod ?? 9;
    const { macdLine, signalLine, histogram } = computeMacdValues(prices, fast, slow, sig);
    return {
      lines: [
        { label: `MACD ${fast}`, color: indicator.color, values: macdLine },
        { label: `Signal ${sig}`, color: '#f59e0b', values: signalLine },
      ],
      histogram: { values: histogram, upColor: '#22c55e88', downColor: '#ef444488' },
      referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
    };
  }

  if (indicator.type === 'ao') {
    const values = computeAoValues(prices);
    return {
      lines: [{ label: 'AO', color: indicator.color, values }],
      histogram: { values, upColor: '#22c55e88', downColor: '#ef444488' },
      referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
    };
  }

  if (indicator.type === 'atr') {
    const values = computeAtrValues(prices, indicator.period);
    return {
      lines: [{ label: `ATR ${indicator.period}`, color: indicator.color, values }],
    };
  }

  return { lines: [] };
}

export function indicatorLabel(
  indicator: Pick<IndicatorConfig, 'type' | 'period' | 'fastPeriod' | 'slowPeriod' | 'signalPeriod' | 'bbStdDev'>,
): string {
  if (indicator.type === 'volume')   return 'Volume';
  if (indicator.type === 'fractals') return 'Fractals';
  if (indicator.type === 'macd') {
    return `MACD ${indicator.fastPeriod ?? 12},${indicator.slowPeriod ?? 26},${indicator.signalPeriod ?? 9}`;
  }
  if (indicator.type === 'bb') return `BB ${indicator.period} (${indicator.bbStdDev ?? 2})`;
  return `${indicator.type.toUpperCase()} ${indicator.period}`;
}
