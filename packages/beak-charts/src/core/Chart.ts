import type { ChartOptions, DataPoint, SeriesOptions, DrawingConfig, DrawingToolType, Plugin } from '../types.ts';
import type { Theme } from '../theme/types.ts';
import { darkTheme } from '../theme/dark.ts';
import { Viewport } from './Viewport.ts';
import { Renderer, type DrawLayer } from './Renderer.ts';
import { DataManager } from './DataManager.ts';
import { CandlestickSeries } from '../series/CandlestickSeries.ts';
import { LineSeries } from '../series/LineSeries.ts';
import { HistogramSeries } from '../series/HistogramSeries.ts';
import { BarSeries } from '../series/BarSeries.ts';
import type { BaseSeries } from '../series/BaseSeries.ts';
import { TimeScale } from '../scales/TimeScale.ts';
import { PriceScale } from '../scales/PriceScale.ts';
import { EventRouter } from '../interaction/EventRouter.ts';
import { PanHandler } from '../interaction/PanHandler.ts';
import { ZoomHandler } from '../interaction/ZoomHandler.ts';
import { CrosshairHandler } from '../interaction/CrosshairHandler.ts';
import { AxisDragHandler } from '../interaction/AxisDragHandler.ts';
import {
  DrawingInteractionHandler,
  type InteractionMode,
  type DrawingChangeCallback,
} from '../interaction/DrawingInteractionHandler.ts';
import { DrawingManager } from '../drawing/DrawingManager.ts';
import { PluginHost } from '../plugins/PluginHost.ts';

const DEFAULT_OPTIONS: ChartOptions = {
  width: 600,
  height: 400,
  autoSize: true,
  theme: darkTheme,
  timeScale: {},
  rightPriceScale: {},
  crosshair: { enabled: true, showPriceLabel: true, showTimeLabel: true },
  grid: { vertLines: true, horzLines: true },
};

export type SeriesHandle = {
  id: string;
  setData(data: DataPoint[]): void;
  setVisible(visible: boolean): void;
  remove(): void;
};

export type ChartCursorMode = 'default' | 'crosshair' | 'grab';

export class Chart {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _viewport: Viewport;
  private _renderer: Renderer;
  private _dataManager: DataManager;
  private _seriesMap = new Map<string, BaseSeries>();
  private _timeScale: TimeScale;
  private _priceScale: PriceScale;
  private _options: ChartOptions;
  private _resizeObserver: ResizeObserver | null = null;
  private _eventRouter: EventRouter;
  private _panHandler: PanHandler;
  private _zoomHandler: ZoomHandler;
  private _crosshairHandler: CrosshairHandler;
  private _axisDragHandler: AxisDragHandler;
  private _drawingInteractionHandler: DrawingInteractionHandler;
  private _drawingManager: DrawingManager;
  private _pluginHost: PluginHost;
  private _nextSeriesId = 0;
  private _destroyed = false;

  // Draw layers
  private _gridLayer: DrawLayer;
  private _seriesLayer: DrawLayer;
  private _drawingLayer: DrawLayer;
  private _crosshairLayer: DrawLayer;
  private _scaleLayer: DrawLayer;

  constructor(container: HTMLElement, options: Partial<ChartOptions> = {}) {
    this._container = container;
    this._options = deepMerge(DEFAULT_OPTIONS, options) as ChartOptions;

    // Create canvas
    this._canvas = document.createElement('canvas');
    this._canvas.style.display = 'block';
    this._canvas.style.cursor = 'crosshair';
    container.appendChild(this._canvas);

    // Initialize subsystems
    this._viewport = new Viewport(this._options.timeScale, this._options.rightPriceScale);
    this._renderer = new Renderer(this._canvas, this._options.theme);
    this._dataManager = new DataManager();
    this._timeScale = new TimeScale();
    this._priceScale = new PriceScale();
    this._drawingManager = new DrawingManager();
    this._pluginHost = new PluginHost();

    // Interaction
    this._eventRouter = new EventRouter(this._canvas);
    this._panHandler = new PanHandler(this._viewport, this._dataManager, () => this._renderer.requestDraw());
    this._zoomHandler = new ZoomHandler(this._viewport, this._dataManager, () => this._renderer.requestDraw());
    this._crosshairHandler = new CrosshairHandler(
      this._viewport,
      this._dataManager,
      this._options.crosshair,
      () => this._renderer.requestDraw(),
    );
    this._axisDragHandler = new AxisDragHandler(
      this._viewport,
      this._dataManager,
      this._canvas,
      () => this._renderer.requestDraw(),
    );
    this._drawingInteractionHandler = new DrawingInteractionHandler(
      this._viewport,
      this._dataManager,
      this._drawingManager,
      this._canvas,
      () => this._renderer.requestDraw(),
    );

    this._eventRouter.addHandler(this._drawingInteractionHandler);
    this._eventRouter.addHandler(this._axisDragHandler);
    this._eventRouter.addHandler(this._panHandler);
    this._eventRouter.addHandler(this._zoomHandler);
    this._eventRouter.addHandler(this._crosshairHandler);

    // Create draw layers
    this._gridLayer = {
      zIndex: 0,
      draw: (ctx, _w, _h, theme) => {
        this._timeScale.draw(ctx, this._viewport, this._dataManager, theme, this._options.grid.vertLines);
        this._priceScale.draw(ctx, this._viewport, theme, this._options.grid.horzLines);
      },
    };

    this._seriesLayer = {
      zIndex: 10,
      draw: (ctx, _w, _h, theme) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this._viewport.chartWidth, this._viewport.chartHeight);
        ctx.clip();
        for (const series of this._seriesMap.values()) {
          series.draw(ctx, this._viewport, null, this._dataManager, theme);
        }
        ctx.restore();
      },
    };

    this._drawingLayer = {
      zIndex: 20,
      draw: (ctx, _w, _h, theme) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this._viewport.chartWidth, this._viewport.chartHeight);
        ctx.clip();
        this._drawingManager.draw(ctx, this._viewport, this._dataManager, theme);
        this._drawingInteractionHandler.drawPreview(ctx, this._viewport, this._dataManager, theme);
        ctx.restore();
      },
    };

    this._crosshairLayer = {
      zIndex: 30,
      draw: (ctx, _w, _h, theme) => {
        this._crosshairHandler.draw(ctx, this._viewport, this._dataManager, theme);
      },
    };

    this._scaleLayer = {
      zIndex: 40,
      draw: (ctx, _w, _h, theme) => {
        // Price scale background
        const chartW = this._viewport.chartWidth;
        const scaleW = this._viewport.priceScaleWidth;
        ctx.fillStyle = theme.colors.background;
        ctx.fillRect(chartW, 0, scaleW, this._viewport.height);
        this._priceScale.draw(ctx, this._viewport, theme, false);

        // Time scale background
        const chartH = this._viewport.chartHeight;
        ctx.fillStyle = theme.colors.background;
        ctx.fillRect(0, chartH, this._viewport.width, this._viewport.timeScaleHeight);
        this._timeScale.draw(ctx, this._viewport, this._dataManager, theme, false);
      },
    };

    this._renderer.addLayer(this._gridLayer);
    this._renderer.addLayer(this._seriesLayer);
    this._renderer.addLayer(this._drawingLayer);
    this._renderer.addLayer(this._crosshairLayer);
    this._renderer.addLayer(this._scaleLayer);

    // Before draw: update price range for auto-scale
    this._renderer.setOnDraw(() => this._updatePriceRange());

    // Size
    if (this._options.autoSize) {
      this._resizeObserver = new ResizeObserver((entries) => {
        if (this._destroyed) return;
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) this.resize(Math.floor(width), Math.floor(height));
      });
      this._resizeObserver.observe(container);
    }
    this._syncSize();
  }

  // ── Public API ──

  addSeries(type: 'candlestick', options?: Partial<SeriesOptions>): SeriesHandle;
  addSeries(type: 'line', options?: Partial<SeriesOptions>): SeriesHandle;
  addSeries(type: 'histogram', options?: Partial<SeriesOptions>): SeriesHandle;
  addSeries(type: 'bar', options?: Partial<SeriesOptions>): SeriesHandle;
  addSeries(type: string, options: Partial<SeriesOptions> = {}): SeriesHandle {
    const id = `series_${this._nextSeriesId++}`;
    const priceScaleId = type === 'histogram' ? 'volume' : 'right';
    let series: BaseSeries;

    switch (type) {
      case 'candlestick':
        series = new CandlestickSeries(id, options as any, priceScaleId);
        break;
      case 'line':
        series = new LineSeries(id, options as any, priceScaleId);
        break;
      case 'histogram':
        series = new HistogramSeries(id, options as any, priceScaleId);
        break;
      case 'bar':
        series = new BarSeries(id, options as any, priceScaleId);
        break;
      default:
        throw new Error(`Unknown series type: ${type}`);
    }

    this._seriesMap.set(id, series);
    this._dataManager.addSeries(id, type as any, priceScaleId);
    this._renderer.requestDraw();

    return {
      id,
      setData: (data: DataPoint[]) => {
        this._dataManager.setData(id, data);
        this._viewport.markDirty();
        this._renderer.requestDraw();
      },
      setVisible: (visible: boolean) => {
        this._dataManager.setSeriesVisibility(id, visible);
        this._renderer.requestDraw();
      },
      remove: () => {
        this._seriesMap.delete(id);
        this._dataManager.removeSeries(id);
        this._renderer.requestDraw();
      },
    };
  }

  setTheme(theme: Theme): void {
    this._options.theme = theme;
    this._renderer.setTheme(theme);
  }

  getTheme(): Theme {
    return this._options.theme;
  }

  resize(width: number, height: number): void {
    this._viewport.setSize(width, height);
    this._renderer.resize(width, height);
  }

  getViewport(): Viewport {
    return this._viewport;
  }

  getDataManager(): DataManager {
    return this._dataManager;
  }

  getDrawingManager(): DrawingManager {
    return this._drawingManager;
  }

  getEventRouter(): EventRouter {
    return this._eventRouter;
  }

  setDrawingMode(toolType: DrawingToolType | null): void {
    this.setInteractionMode(toolType);
  }

  setInteractionMode(mode: InteractionMode): void {
    this._drawingInteractionHandler.setMode(mode);
  }

  getInteractionMode(): InteractionMode {
    return this._drawingInteractionHandler.mode;
  }

  onDrawingChange(cb: DrawingChangeCallback | null): void {
    this._drawingInteractionHandler.setOnChange(cb);
  }

  getSelectedDrawingId(): string | null {
    return this._drawingInteractionHandler.selectedDrawingId;
  }

  deleteSelectedDrawing(): void {
    this._drawingInteractionHandler.deleteSelected();
  }

  setPanEnabled(enabled: boolean): void {
    this._panHandler.setEnabled(enabled);
  }

  setChartCursorMode(mode: ChartCursorMode): void {
    this._axisDragHandler.setChartCursor(mode);
    if (this._drawingInteractionHandler.mode === null) {
      this._canvas.style.cursor = mode;
    }
  }

  setCrosshairMeasureEnabled(enabled: boolean): void {
    this._crosshairHandler.setMeasureEnabled(enabled);
  }

  addDrawing(config: DrawingConfig): void {
    this._drawingManager.addDrawing(config);
    this._renderer.requestDraw();
  }

  removeDrawing(id: string): void {
    this._drawingManager.removeDrawing(id);
    this._renderer.requestDraw();
  }

  addPlugin(plugin: Plugin): void {
    this._pluginHost.register(plugin);
  }

  removePlugin(name: string): void {
    this._pluginHost.unregister(name);
  }

  scrollToEnd(): void {
    this._viewport.scrollTo(0);
    this._renderer.requestDraw();
  }

  /** Zoom the X axis (time). factor > 1 zooms in, < 1 zooms out. centerX is in chart coordinates. */
  zoomX(factor: number, centerX: number): void {
    const totalBars = this._dataManager.getTotalBars();
    if (totalBars <= 0) return;
    this._viewport.zoomX(factor, centerX, totalBars);
    this._renderer.requestDraw();
  }

  destroy(): void {
    this._destroyed = true;
    this._resizeObserver?.disconnect();
    this._eventRouter.destroy();
    this._renderer.destroy();
    this._canvas.remove();
  }

  // ── Private ──

  private _syncSize(): void {
    const rect = this._container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.resize(rect.width, rect.height);
    }
  }

  private _updatePriceRange(): void {
    const totalBars = this._dataManager.getTotalBars();
    if (totalBars === 0) return;

    const range = this._viewport.getVisibleRange(totalBars);
    const mainSeriesIds = this._dataManager
      .getSeriesByPriceScale('right')
      .map((s) => s.id);

    if (mainSeriesIds.length > 0) {
      const { min, max } = this._dataManager.getPriceRange(
        mainSeriesIds,
        range.startIndex,
        range.endIndex,
      );
      this._viewport.setPriceRange(min, max);
    }
  }
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
