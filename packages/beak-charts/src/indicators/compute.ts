import type { LineDataPoint } from '../types.ts';
import type {
  IndicatorConfig,
  IndicatorSource,
  BottomIndicatorData,
  FractalPoint,
  KangarooTailPoint,
  EngulfingPoint,
  InsideBarPoint,
  OpenLineSegment,
  ZigZagPoint,
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

// ── Kangaroo Tail (Pinbar) ────────────────────────────────────────────────────
//
// Detection rules:
//   1. body (|close - open|) < 30 % of the full candle range (high - low)
//   2. Bullish hammer: lower wick > upper wick AND body sits in the upper
//      65 % of the range — the long tail points downward
//   3. Bearish shooting star: upper wick > lower wick AND body sits in the
//      lower 65 % of the range — the long tail points upward
//   4. Body (open & close) must lie within the previous candle's high-low range
//   5. The kangaroo tail's full range must NOT be engulfed by the previous
//      candle's range — the tail (wick) must poke out beyond it

export function computeKangarooTails(
  prices: PriceBar[],
): { bullish: KangarooTailPoint[]; bearish: KangarooTailPoint[] } {
  const bullish: KangarooTailPoint[] = [];
  const bearish: KangarooTailPoint[] = [];

  for (let i = 1; i < prices.length; i++) {
    const { open, high, low, close } = prices[i]!;
    const { high: prevHigh, low: prevLow } = prices[i - 1]!;

    const range = high - low;
    if (range <= 0) continue;

    const body       = Math.abs(close - open);
    if (body / range >= 0.30) continue;

    const bodyTop    = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const upperWick  = high - bodyTop;
    const lowerWick  = bodyBottom - low;

    // Rule 4: body must be within the previous candle's range
    if (bodyBottom < prevLow || bodyTop > prevHigh) continue;

    // Rule 5: the tail's range must not be fully engulfed by the previous candle
    if (low >= prevLow && high <= prevHigh) continue;

    // Bullish hammer — body in upper 35 % of range, tail points down
    if (bodyBottom >= low + range * 0.65 && lowerWick > upperWick) {
      bullish.push({ barIndex: i, price: low });
    // Bearish shooting star — body in lower 35 % of range, tail points up
    } else if (bodyTop <= high - range * 0.65 && upperWick > lowerWick) {
      bearish.push({ barIndex: i, price: high });
    }
  }

  return { bullish, bearish };
}

// ── Engulfing Candle ──────────────────────────────────────────────────────────
//
// Detection rules:
//   Bullish engulfing:
//     - Current candle is bullish (close > open)
//     - Previous candle is bearish (close < open)
//     - Current candle's full range engulfs previous candle's full range:
//       current low ≤ prev low  AND  current high ≥ prev high
//
//   Bearish engulfing:
//     - Current candle is bearish (close < open)
//     - Previous candle is bullish (close > open)
//     - Current candle's full range engulfs previous candle's full range:
//       current low ≤ prev low  AND  current high ≥ prev high

export function computeEngulfingCandles(
  prices: PriceBar[],
): { bullish: EngulfingPoint[]; bearish: EngulfingPoint[] } {
  const bullish: EngulfingPoint[] = [];
  const bearish: EngulfingPoint[] = [];

  for (let i = 1; i < prices.length; i++) {
    const curr = prices[i]!;
    const prev = prices[i - 1]!;

    // Full range of current must completely cover full range of previous
    if (curr.low > prev.low || curr.high < prev.high) continue;

    const currBullish = curr.close > curr.open;
    const currBearish = curr.close < curr.open;
    const prevBearish = prev.close < prev.open;
    const prevBullish = prev.close > prev.open;

    if (currBullish && prevBearish) {
      bullish.push({ barIndex: i, price: curr.low });
    } else if (currBearish && prevBullish) {
      bearish.push({ barIndex: i, price: curr.high });
    }
  }

  return { bullish, bearish };
}

// ── Inside Bar ────────────────────────────────────────────────────────────────
//
// Detection rule:
//   The previous candle's full range completely contains the current candle's
//   full range:  prev.low ≤ curr.low  AND  prev.high ≥ curr.high

export function computeInsideBars(prices: PriceBar[]): InsideBarPoint[] {
  const points: InsideBarPoint[] = [];

  for (let i = 1; i < prices.length; i++) {
    const curr = prices[i]!;
    const prev = prices[i - 1]!;

    if (curr.high <= prev.high && curr.low >= prev.low) {
      points.push({ barIndex: i, price: curr.low });
    }
  }

  return points;
}

// ── Open Lines ────────────────────────────────────────────────────────────────
//
// For each period type (daily / weekly / monthly) the function groups bars by
// which UTC-based session they belong to (using an optional hour offset to
// shift the session start), then records the open price of the first bar in
// that group as the level to draw.

function updateOpenGroup(
  map: Map<string, { first: number; last: number; open: number }>,
  key: string,
  idx: number,
  open: number,
): void {
  const g = map.get(key);
  if (!g) { map.set(key, { first: idx, last: idx, open }); }
  else     { g.last = idx; }
}

export function computeOpenLines(
  prices: PriceBar[],
  config: {
    lookbackDays:    number;
    dailyStartHour:  number;   // 0-23 UTC
    weeklyStartHour: number;   // 0-23 UTC (week resets each Monday after this hour)
    monthlyStartHour: number;  // 0-23 UTC
  },
): { daily: OpenLineSegment[]; weekly: OpenLineSegment[]; monthly: OpenLineSegment[] } {
  if (prices.length === 0) return { daily: [], weekly: [], monthly: [] };

  const { lookbackDays, dailyStartHour, weeklyStartHour, monthlyStartHour } = config;
  const latestTime = prices[prices.length - 1]!.time;
  const cutoffTime = latestTime - lookbackDays * 86_400_000;

  const dailyMap   = new Map<string, { first: number; last: number; open: number }>();
  const weeklyMap  = new Map<string, { first: number; last: number; open: number }>();
  const monthlyMap = new Map<string, { first: number; last: number; open: number }>();

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i]!;
    if (p.time < cutoffTime) continue;

    // ── Daily ──
    const dTs = p.time - dailyStartHour * 3_600_000;
    const dD  = new Date(dTs);
    updateOpenGroup(
      dailyMap,
      `${dD.getUTCFullYear()}-${dD.getUTCMonth()}-${dD.getUTCDate()}`,
      i, p.open,
    );

    // ── Weekly (Monday-anchored) ──
    const wTs  = p.time - weeklyStartHour * 3_600_000;
    const wD   = new Date(wTs);
    const dow  = wD.getUTCDay();                    // 0=Sun…6=Sat
    const back = dow === 0 ? 6 : dow - 1;           // days back to Monday
    const monD = new Date(wTs - back * 86_400_000);
    updateOpenGroup(
      weeklyMap,
      `W${monD.getUTCFullYear()}-${monD.getUTCMonth()}-${monD.getUTCDate()}`,
      i, p.open,
    );

    // ── Monthly ──
    const mTs = p.time - monthlyStartHour * 3_600_000;
    const mD  = new Date(mTs);
    updateOpenGroup(
      monthlyMap,
      `${mD.getUTCFullYear()}-${mD.getUTCMonth()}`,
      i, p.open,
    );
  }

  const toSegments = (
    map: Map<string, { first: number; last: number; open: number }>,
  ): OpenLineSegment[] =>
    Array.from(map.values()).map(g => ({
      startBarIndex: g.first,
      endBarIndex:   g.last,
      price:         g.open,
    }));

  return {
    daily:   toSegments(dailyMap),
    weekly:  toSegments(weeklyMap),
    monthly: toSegments(monthlyMap),
  };
}

// ── ZigZag ────────────────────────────────────────────────────────────────────
//
// Connects swing highs and lows, filtering out moves smaller than `deviationPct`%.
//
// Algorithm:
//   - Seed direction from bars 0→1.
//   - Track the running extreme (highest high in an upswing, lowest low in a downswing).
//   - When price reverses by more than `deviationPct`% from the extreme, push the
//     extreme as a confirmed pivot and flip direction.
//   - Append a trailing (unconfirmed) pivot at the current extreme so the line
//     always extends to the most recent bar.

export function computeZigZag(prices: PriceBar[], deviationPct: number): ZigZagPoint[] {
  if (prices.length < 2) return [];

  const threshold = Math.max(0.001, deviationPct / 100);
  const pivots: ZigZagPoint[] = [];

  // Seed: use the close-to-close direction of the first bar to set initial state
  let dir: 'up' | 'down';
  let extPrice: number;
  let extIdx = 0;

  if (prices[1]!.close >= prices[0]!.close) {
    dir      = 'up';
    extPrice = prices[0]!.low;
    pivots.push({ barIndex: 0, price: extPrice, type: 'low' });
  } else {
    dir      = 'down';
    extPrice = prices[0]!.high;
    pivots.push({ barIndex: 0, price: extPrice, type: 'high' });
  }

  for (let i = 1; i < prices.length; i++) {
    const { high, low } = prices[i]!;

    if (dir === 'up') {
      if (low < extPrice * (1 - threshold)) {
        // Reversal — confirm the swing high
        pivots.push({ barIndex: extIdx, price: extPrice, type: 'high' });
        dir      = 'down';
        extPrice = low;
        extIdx   = i;
      } else if (high > extPrice) {
        extPrice = high;
        extIdx   = i;
      }
    } else {
      if (high > extPrice * (1 + threshold)) {
        // Reversal — confirm the swing low
        pivots.push({ barIndex: extIdx, price: extPrice, type: 'low' });
        dir      = 'up';
        extPrice = high;
        extIdx   = i;
      } else if (low < extPrice) {
        extPrice = low;
        extIdx   = i;
      }
    }
  }

  // Trailing unconfirmed extreme — keeps the line current
  pivots.push({ barIndex: extIdx, price: extPrice, type: dir === 'up' ? 'high' : 'low' });

  // Always extend to the very last bar so the line is visible even when
  // no reversal threshold has been crossed (e.g. tight range data).
  const lastIdx = prices.length - 1;
  if (extIdx < lastIdx) {
    pivots.push({
      barIndex: lastIdx,
      price: prices[lastIdx]!.close,
      type: dir === 'up' ? 'low' : 'high',
    });
  }

  return pivots;
}

// ── Orchestrators ─────────────────────────────────────────────────────────────

export function computeIndicatorData(prices: PriceBar[], indicator: IndicatorConfig): LineDataPoint[] {
  if (indicator.type === 'bb')            return computeBBValues(prices, indicator).middle;
  if (indicator.type === 'volume')        return prices.map(p => ({ time: p.time, value: p.volume ?? null }));
  if (indicator.type === 'fractals')      return prices.map(p => ({ time: p.time, value: null }));
  if (indicator.type === 'kangarooTail')  return prices.map(p => ({ time: p.time, value: null }));
  if (indicator.type === 'zigzag')        return prices.map(p => ({ time: p.time, value: null }));
  if (indicator.type === 'engulfing')     return prices.map(p => ({ time: p.time, value: null }));
  if (indicator.type === 'insideBar')     return prices.map(p => ({ time: p.time, value: null }));
  if (indicator.type === 'openLines')     return prices.map(p => ({ time: p.time, value: null }));

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
  if (indicator.type === 'volume')        return 'Volume';
  if (indicator.type === 'fractals')      return 'Fractals';
  if (indicator.type === 'kangarooTail')  return 'Kangaroo Tail';
  if (indicator.type === 'zigzag')        return `ZigZag ${indicator.period}%`;
  if (indicator.type === 'engulfing')     return 'Engulfing Candle';
  if (indicator.type === 'insideBar')     return 'Inside Bar';
  if (indicator.type === 'openLines')     return 'Open Lines';
  if (indicator.type === 'macd') {
    return `MACD ${indicator.fastPeriod ?? 12},${indicator.slowPeriod ?? 26},${indicator.signalPeriod ?? 9}`;
  }
  if (indicator.type === 'bb') return `BB ${indicator.period} (${indicator.bbStdDev ?? 2})`;
  return `${indicator.type.toUpperCase()} ${indicator.period}`;
}
