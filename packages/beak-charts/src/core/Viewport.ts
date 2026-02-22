import type { VisibleRange, TimeScaleOptions, PriceScaleOptions } from '../types.ts';

const DEFAULT_TIME_SCALE: TimeScaleOptions = {
  height: 28,
  barSpacing: 8,
  minBarSpacing: 2,
  maxBarSpacing: 40,
  rightOffset: 5,
};

const DEFAULT_PRICE_SCALE: PriceScaleOptions = {
  id: 'right',
  position: 'right',
  width: 65,
  autoScale: true,
  scaleMargins: { top: 0.1, bottom: 0.1 },
};

export class Viewport {
  private _barOffset = 0;
  private _barSpacing: number;
  private _minBarSpacing: number;
  private _maxBarSpacing: number;
  private _rightOffset: number;
  private _priceRangeMin = 0;
  private _priceRangeMax = 1;
  private _priceManualMin: number | null = null;
  private _priceManualMax: number | null = null;
  private _autoScale = true;
  private _width = 0;
  private _height = 0;
  private _timeScaleHeight: number;
  private _priceScaleWidth: number;
  private _priceScaleMargins: { top: number; bottom: number };
  private _dirty = true;

  constructor(
    timeOpts: Partial<TimeScaleOptions> = {},
    priceOpts: Partial<PriceScaleOptions> = {},
  ) {
    const ts = { ...DEFAULT_TIME_SCALE, ...timeOpts };
    const ps = { ...DEFAULT_PRICE_SCALE, ...priceOpts };
    this._barSpacing = ts.barSpacing;
    this._minBarSpacing = ts.minBarSpacing;
    this._maxBarSpacing = ts.maxBarSpacing;
    this._rightOffset = ts.rightOffset;
    this._timeScaleHeight = ts.height;
    this._priceScaleWidth = ps.width;
    this._priceScaleMargins = ps.scaleMargins;
    this._autoScale = ps.autoScale;
  }

  get dirty(): boolean { return this._dirty; }
  clearDirty(): void { this._dirty = false; }
  markDirty(): void { this._dirty = true; }

  get barSpacing(): number { return this._barSpacing; }
  get barOffset(): number { return this._barOffset; }
  get timeScaleHeight(): number { return this._timeScaleHeight; }
  get priceScaleWidth(): number { return this._priceScaleWidth; }
  get chartWidth(): number { return this._width - this._priceScaleWidth; }
  get chartHeight(): number { return this._height - this._timeScaleHeight; }
  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get priceMin(): number { return this._priceRangeMin; }
  get priceMax(): number { return this._priceRangeMax; }
  get rightOffset(): number { return this._rightOffset; }

  setSize(w: number, h: number): void {
    if (w !== this._width || h !== this._height) {
      this._width = w;
      this._height = h;
      this._dirty = true;
    }
  }

  getVisibleRange(totalBars: number): VisibleRange {
    const barsVisible = Math.ceil(this.chartWidth / this._barSpacing);
    const endIndex = Math.min(
      totalBars - 1 + this._rightOffset,
      totalBars - 1 - this._barOffset + this._rightOffset,
    );
    const startIndex = endIndex - barsVisible;
    return {
      startIndex: Math.max(0, Math.floor(startIndex)),
      endIndex: Math.min(totalBars - 1, Math.ceil(endIndex)),
    };
  }

  barIndexToX(barIndex: number, totalBars: number): number {
    const range = this.getVisibleRange(totalBars);
    const visibleIndex = barIndex - range.startIndex;
    return visibleIndex * this._barSpacing + this._barSpacing / 2;
  }

  xToBarIndex(x: number, totalBars: number): number {
    const range = this.getVisibleRange(totalBars);
    return Math.round(range.startIndex + (x - this._barSpacing / 2) / this._barSpacing);
  }

  priceToY(price: number): number {
    const top = this._priceScaleMargins.top * this.chartHeight;
    const bottom = this.chartHeight * (1 - this._priceScaleMargins.bottom);
    const drawHeight = bottom - top;
    const range = this._priceRangeMax - this._priceRangeMin;
    if (range === 0) return top + drawHeight / 2;
    return top + ((this._priceRangeMax - price) / range) * drawHeight;
  }

  yToPrice(y: number): number {
    const top = this._priceScaleMargins.top * this.chartHeight;
    const bottom = this.chartHeight * (1 - this._priceScaleMargins.bottom);
    const drawHeight = bottom - top;
    const range = this._priceRangeMax - this._priceRangeMin;
    return this._priceRangeMax - ((y - top) / drawHeight) * range;
  }

  setPriceRange(min: number, max: number): void {
    if (this._autoScale && this._priceManualMin === null) {
      const padding = (max - min) * 0.02 || 0.001;
      this._priceRangeMin = min - padding;
      this._priceRangeMax = max + padding;
      this._dirty = true;
    }
  }

  setManualPriceRange(min: number, max: number): void {
    this._priceManualMin = min;
    this._priceManualMax = max;
    this._priceRangeMin = min;
    this._priceRangeMax = max;
    this._autoScale = false;
    this._dirty = true;
  }

  resetAutoScale(): void {
    this._priceManualMin = null;
    this._priceManualMax = null;
    this._autoScale = true;
    this._dirty = true;
  }

  scrollBy(barsDelta: number): void {
    this._barOffset += barsDelta;
    this._dirty = true;
  }

  scrollTo(barOffset: number): void {
    this._barOffset = barOffset;
    this._dirty = true;
  }

  zoomX(factor: number, centerX: number, totalBars: number): void {
    const centerBar = this.xToBarIndex(centerX, totalBars);
    const newSpacing = Math.min(
      this._maxBarSpacing,
      Math.max(this._minBarSpacing, this._barSpacing * factor),
    );
    if (newSpacing !== this._barSpacing) {
      this._barSpacing = newSpacing;
      this._dirty = true;
    }
  }

  zoomY(factor: number): void {
    const mid = (this._priceRangeMax + this._priceRangeMin) / 2;
    const halfRange = (this._priceRangeMax - this._priceRangeMin) / 2;
    const newHalf = halfRange / factor;
    this._priceManualMin = mid - newHalf;
    this._priceManualMax = mid + newHalf;
    this._priceRangeMin = this._priceManualMin;
    this._priceRangeMax = this._priceManualMax;
    this._autoScale = false;
    this._dirty = true;
  }

  /** Get a separate viewport configured for a sub-pane (e.g., volume occupying bottom 20%) */
  createSubPane(topFraction: number, bottomFraction: number): SubPaneViewport {
    return new SubPaneViewport(this, topFraction, bottomFraction);
  }
}

export class SubPaneViewport {
  constructor(
    private parent: Viewport,
    private topFraction: number,
    private bottomFraction: number,
  ) {}

  private _min = 0;
  private _max = 1;

  get chartHeight(): number {
    return this.parent.chartHeight;
  }

  get paneTop(): number {
    return this.topFraction * this.parent.chartHeight;
  }

  get paneHeight(): number {
    return (this.bottomFraction - this.topFraction) * this.parent.chartHeight;
  }

  setPriceRange(min: number, max: number): void {
    const padding = (max - min) * 0.05 || 0.001;
    this._min = min - padding;
    this._max = max + padding;
  }

  priceToY(price: number): number {
    const range = this._max - this._min;
    if (range === 0) return this.paneTop + this.paneHeight / 2;
    return this.paneTop + ((this._max - price) / range) * this.paneHeight;
  }
}
