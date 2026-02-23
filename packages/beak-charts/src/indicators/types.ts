// ── Indicator Configuration ──────────────────────────────────────────────────

export type IndicatorType =
  | 'sma'
  | 'ema'
  | 'ao'
  | 'rsi'
  | 'macd'
  | 'atr'
  | 'bb'
  | 'volume'
  | 'fractals';

export type IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'median';
export type IndicatorStyle  = 'solid' | 'dashed' | 'dotted';
export type IndicatorPlacement = 'overlay' | 'bottom';

export type IndicatorConfig = {
  id: string;
  type: IndicatorType;
  placement: IndicatorPlacement;
  period: number;
  color: string;
  visible: boolean;
  source: IndicatorSource;
  offset: number;
  lineWidth: number;
  style: IndicatorStyle;
  overbought?: number;
  oversold?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  bbStdDev?: number;
};

// ── Bottom Panel Data ─────────────────────────────────────────────────────────

export type BottomIndicatorData = {
  lines: Array<{ label: string; color: string; values: (number | null)[] }>;
  histogram?: { values: (number | null)[]; upColor: string; downColor: string };
  referenceLines?: Array<{ value: number; color: string; dashed: boolean }>;
  yRange?: { min: number; max: number };
};

// ── Fractals ──────────────────────────────────────────────────────────────────

export type FractalPoint = { barIndex: number; price: number };

export type FractalData = {
  up: FractalPoint[];
  down: FractalPoint[];
  color: string;
  visible: boolean;
};

// ── Normalised price bar used by all compute functions ────────────────────────

export type PriceBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
