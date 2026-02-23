import type { Theme } from './theme/types.ts';

// ── Data Types ──

export type OHLCV = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type LineDataPoint = {
  time: number;
  value: number | null;
};

export type HistogramDataPoint = {
  time: number;
  value: number | null;
  color?: string;
};

export type DataPoint = OHLCV | LineDataPoint | HistogramDataPoint;

// ── Series Types ──

export type SeriesType = 'candlestick' | 'bar' | 'line' | 'histogram';

export type CandlestickSeriesOptions = {
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderUpColor: string;
  borderDownColor: string;
};

export type LineSeriesOptions = {
  color: string;
  lineWidth: number;
  pointRadius: number;
};

export type HistogramSeriesOptions = {
  upColor: string;
  downColor: string;
  opacity: number;
};

export type BarSeriesOptions = {
  upColor: string;
  downColor: string;
  thinBars: boolean;
};

export type SeriesOptions =
  | ({ type: 'candlestick' } & Partial<CandlestickSeriesOptions>)
  | ({ type: 'line' } & Partial<LineSeriesOptions>)
  | ({ type: 'histogram' } & Partial<HistogramSeriesOptions>)
  | ({ type: 'bar' } & Partial<BarSeriesOptions>);

export type SeriesConfig = {
  id: string;
  type: SeriesType;
  data: DataPoint[];
  options: SeriesOptions;
  priceScaleId: string;
  visible: boolean;
};

// ── Scale Types ──

export type PriceScaleOptions = {
  id: string;
  position: 'left' | 'right';
  width: number;
  autoScale: boolean;
  scaleMargins: { top: number; bottom: number };
};

export type TimeScaleOptions = {
  height: number;
  barSpacing: number;
  minBarSpacing: number;
  maxBarSpacing: number;
  rightOffset: number;
};

// ── Chart Options ──

export type ChartOptions = {
  width: number;
  height: number;
  autoSize: boolean;
  theme: Theme;
  timeScale: Partial<TimeScaleOptions>;
  rightPriceScale: Partial<PriceScaleOptions>;
  crosshair: {
    enabled: boolean;
    showPriceLabel: boolean;
    showTimeLabel: boolean;
  };
  grid: {
    vertLines: boolean;
    horzLines: boolean;
  };
};

// ── Drawing Types ──

export type DrawingToolType =
  | 'horizontalLine'
  | 'trendLine'
  | 'box'
  | 'arrow'
  | 'arrowUp'
  | 'arrowDown'
  | 'fibonacci';

export type DrawingAnchor = {
  barIndex: number;
  price: number;
};

export type DrawingConfig = {
  id: string;
  type: DrawingToolType;
  anchors: DrawingAnchor[];
  color: string;
  lineWidth: number;
  visible: boolean;
};

// ── Viewport Types ──

export type VisibleRange = {
  startIndex: number;
  endIndex: number;
};

export type ViewportState = {
  barOffset: number;
  barSpacing: number;
  priceOffset: number;
  priceScale: number;
};

// ── Plugin Types ──

export type PluginHook =
  | 'beforeDraw'
  | 'afterDraw'
  | 'onCrosshairMove'
  | 'onVisibleRangeChange'
  | 'onResize';

export type PluginContext = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  theme: Theme;
};

export type Plugin = {
  name: string;
  hooks: Partial<Record<PluginHook, (ctx: PluginContext) => void>>;
};

// ── Re-exports ──

export type { Theme, ThemeColors } from './theme/types.ts';
