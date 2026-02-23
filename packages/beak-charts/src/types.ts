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

export type FibLevel = {
  ratio: number;
  label: string;
  visible: boolean;
};

export const DEFAULT_FIB_LEVELS: FibLevel[] = [
  { ratio: 0,     label: '0',     visible: true },
  { ratio: 0.236, label: '0.236', visible: true },
  { ratio: 0.382, label: '0.382', visible: true },
  { ratio: 0.5,   label: '0.5',   visible: true },
  { ratio: 0.618, label: '0.618', visible: true },
  { ratio: 0.786, label: '0.786', visible: true },
  { ratio: 1,     label: '1',     visible: true },
];

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
  fibLevels?: FibLevel[];
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

/** Structural interface for the viewport, used in PluginContext to avoid circular imports. */
export type PluginViewport = {
  barIndexToX(barIndex: number, totalBars: number): number;
  priceToY(price: number): number;
  getVisibleRange(totalBars: number): VisibleRange;
  readonly chartWidth: number;
  readonly chartHeight: number;
  readonly barSpacing: number;
};

/** Structural interface for the data manager, used in PluginContext. */
export type PluginDataManager = {
  getTotalBars(): number;
};

export type PluginContext = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  theme: Theme;
  viewport: PluginViewport;
  dataManager: PluginDataManager;
};

export type Plugin = {
  name: string;
  hooks: Partial<Record<PluginHook, (context: PluginContext) => void>>;
};

// ── Re-exports ──

export type { Theme, ThemeColors } from './theme/types.ts';
