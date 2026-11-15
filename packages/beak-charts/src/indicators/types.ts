import type { LineDataPoint } from '../types.ts';
export type { LineDataPoint } from '../types.ts';

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
  | 'fractals'
  | 'kangarooTail'
  | 'zigzag'
  | 'engulfing'
  | 'insideBar'
  | 'openLines';

export type IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'median';
export type IndicatorStyle = 'solid' | 'dashed' | 'dotted';
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
  // Open Lines
  showDailyOpen?: boolean;
  showWeeklyOpen?: boolean;
  showMonthlyOpen?: boolean;
  dailyOpenHour?: number;       // UTC start hour for the daily session (0-23)
  weeklyOpenHour?: number;      // UTC start hour for the weekly session (0-23)
  monthlyOpenHour?: number;     // UTC start hour for the monthly session (0-23)
  openLinesLookbackDays?: number;
  dailyOpenColor?: string;
  weeklyOpenColor?: string;
  monthlyOpenColor?: string;
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

// ── Kangaroo Tail ─────────────────────────────────────────────────────────────

/** A single kangaroo-tail (pinbar) detection result. price = low for bullish, high for bearish. */
export type KangarooTailPoint = { barIndex: number; price: number };

export type KangarooTailData = {
  bullish: KangarooTailPoint[];
  bearish: KangarooTailPoint[];
  color: string;
  visible: boolean;
};

// ── Engulfing Candle ──────────────────────────────────────────────────────────

/** A single engulfing-candle detection result. price = low for bullish, high for bearish. */
export type EngulfingPoint = { barIndex: number; price: number };

export type EngulfingData = {
  bullish: EngulfingPoint[];
  bearish: EngulfingPoint[];
  color: string;
  visible: boolean;
};

// ── Inside Bar ────────────────────────────────────────────────────────────────

/** A single inside-bar detection result. price = low of the inside bar. */
export type InsideBarPoint = { barIndex: number; price: number };

export type InsideBarData = {
  points: InsideBarPoint[];
  color: string;
  visible: boolean;
};

// ── Open Lines ────────────────────────────────────────────────────────────────

/** A single open-price horizontal line spanning one period (day / week / month). */
export type OpenLineSegment = {
  startBarIndex: number;
  endBarIndex: number;
  price: number;        // open price of the period
};

export type OpenLinesData = {
  daily: OpenLineSegment[];
  weekly: OpenLineSegment[];
  monthly: OpenLineSegment[];
  showDaily: boolean;
  showWeekly: boolean;
  showMonthly: boolean;
  dailyColor: string;
  weeklyColor: string;
  monthlyColor: string;
  visible: boolean;
};

// ── ZigZag ────────────────────────────────────────────────────────────────────

/** A confirmed (or trailing) swing pivot. type indicates whether it's a swing high or low. */
export type ZigZagPoint = { barIndex: number; price: number; type: 'high' | 'low' };

export type ZigZagData = {
  points: ZigZagPoint[];
  color: string;
  lineWidth: number;
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

export type OHLCVLike = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartEventType = 'onDataUpdate' | 'onVisibleRangeChange';
export type ChartEventPayload = Record<string, unknown>;

export type InitResult = { ok: true } | { ok: false; message: string };
export type DeinitReason =
  | 'removed'
  | 'chart_closed'
  | 'parameters_changed'
  | 'symbol_or_timeframe_changed'
  | 'replaced'
  | 'init_failed';

export type ParamSpec = {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'color';
  default: any;
  min?: number;
  max?: number;
  options?: string[];
};

export type IndicatorComputeContext = {
  placement: IndicatorPlacement;
  instanceId: string;
  chartInstanceId?: string;
};

export type IndicatorInstanceContext = {
  placement: IndicatorPlacement;
  instanceId: string;
  chartInstanceId?: string;
  params: Record<string, unknown>;
  subscribe(event: ChartEventType, handler: (payload: ChartEventPayload) => void): () => void;
  getSourcePrices(): OHLCVLike[];
  getBarCount(): number;
  getVisibleRange(): { startIndex: number; endIndex: number; totalBars: number } | null;
  getCrosshair(): { barIndex: number; price: number; time: number } | null;
  requestDraw(): void;
};

export type IndicatorDefinition = {
  id: string;
  name: string;
  placement: IndicatorPlacement;
  defaultParams?: Record<string, unknown>;
  paramSchema?: ParamSpec[];
  onInit?(context: IndicatorInstanceContext): InitResult;
  onRegistered?(context: IndicatorInstanceContext): void;
  onUnregistered?(context: IndicatorInstanceContext, reason: DeinitReason): void;
  onCleanup?(): void;
  computeOverlay?(prices: OHLCVLike[], params: Record<string, unknown>, ctx: IndicatorComputeContext): LineDataPoint[];
  computeBottom?(prices: OHLCVLike[], params: Record<string, unknown>, ctx: IndicatorComputeContext): BottomIndicatorData;
};
