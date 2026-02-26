// Core
export { Chart } from './core/Chart.ts';
export type { SeriesHandle, ChartCursorMode } from './core/Chart.ts';
export { Viewport, SubPaneViewport } from './core/Viewport.ts';
export { Renderer } from './core/Renderer.ts';
export { DataManager } from './core/DataManager.ts';

// Series
export { BaseSeries } from './series/BaseSeries.ts';
export { CandlestickSeries } from './series/CandlestickSeries.ts';
export { LineSeries } from './series/LineSeries.ts';
export { HistogramSeries } from './series/HistogramSeries.ts';
export { BarSeries } from './series/BarSeries.ts';

// Scales
export { TimeScale } from './scales/TimeScale.ts';
export { PriceScale } from './scales/PriceScale.ts';

// Interaction
export { EventRouter } from './interaction/EventRouter.ts';
export { PanHandler } from './interaction/PanHandler.ts';
export { ZoomHandler } from './interaction/ZoomHandler.ts';
export { CrosshairHandler } from './interaction/CrosshairHandler.ts';
export { AxisDragHandler } from './interaction/AxisDragHandler.ts';
export { DrawingInteractionHandler } from './interaction/DrawingInteractionHandler.ts';
export type {
  InteractionMode,
  DrawingChangeEvent,
  DrawingChangeCallback,
} from './interaction/DrawingInteractionHandler.ts';

// Drawing
export { DrawingManager } from './drawing/DrawingManager.ts';
export { BaseTool } from './drawing/BaseTool.ts';
export { HorizontalLine } from './drawing/HorizontalLine.ts';
export { TrendLine } from './drawing/TrendLine.ts';
export { BoxDraw } from './drawing/BoxDraw.ts';
export { ArrowDraw } from './drawing/ArrowDraw.ts';
export { FibonacciRetracement } from './drawing/FibonacciRetracement.ts';

// Themes
export { darkTheme } from './theme/dark.ts';
export { lightTheme } from './theme/light.ts';

// Plugins
export { PluginHost } from './plugins/PluginHost.ts';

// Indicators — computation
export {
  getSourcePrice,
  computeSmaValues,
  computeEmaValues,
  computeBBValues,
  computeAtrValues,
  computeRsiValues,
  computeMacdValues,
  computeAoValues,
  computeFractals,
  computeKangarooTails,
  computeEngulfingCandles,
  computeInsideBars,
  computeOpenLines,
  computeZigZag,
  computeIndicatorData,
  computeBottomPanelData,
  indicatorLabel,
} from './indicators/compute.ts';

// Indicators — fractal plugin
export { createFractalsPlugin } from './indicators/FractalsPlugin.ts';

// Indicators — kangaroo tail plugin
export { createKangarooTailPlugin } from './indicators/KangarooTailPlugin.ts';

// Indicators — engulfing candle plugin
export { createEngulfingPlugin } from './indicators/EngulfingPlugin.ts';

// Indicators — inside bar plugin
export { createInsideBarPlugin } from './indicators/InsideBarPlugin.ts';

// Indicators — open lines plugin
export { createOpenLinesPlugin } from './indicators/OpenLinesPlugin.ts';

// Indicators — zigzag plugin
export { createZigZagPlugin } from './indicators/ZigZagPlugin.ts';

// Indicators — types
export type {
  IndicatorType,
  IndicatorSource,
  IndicatorStyle,
  IndicatorPlacement,
  IndicatorConfig,
  BottomIndicatorData,
  FractalPoint,
  FractalData,
  KangarooTailPoint,
  KangarooTailData,
  EngulfingPoint,
  EngulfingData,
  InsideBarPoint,
  InsideBarData,
  OpenLineSegment,
  OpenLinesData,
  ZigZagPoint,
  ZigZagData,
  PriceBar,
} from './indicators/types.ts';

// Types
export type {
  OHLCV,
  LineDataPoint,
  HistogramDataPoint,
  DataPoint,
  SeriesType,
  CandlestickSeriesOptions,
  LineSeriesOptions,
  HistogramSeriesOptions,
  BarSeriesOptions,
  SeriesOptions,
  ChartOptions,
  DrawingToolType,
  DrawingAnchor,
  DrawingConfig,
  FibLevel,
  VisibleRange,
  ViewportState,
  Plugin,
  PluginHook,
  PluginContext,
  PluginViewport,
  PluginDataManager,
  Theme,
  ThemeColors,
  TimeScaleOptions,
  PriceScaleOptions,
} from './types.ts';
export { DEFAULT_FIB_LEVELS } from './types.ts';
