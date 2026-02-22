import type { InputHandler, InputEvent } from './EventRouter.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

type CrosshairConfig = {
  enabled: boolean;
  showPriceLabel: boolean;
  showTimeLabel: boolean;
};

export class CrosshairHandler implements InputHandler {
  priority = 5;
  private _x: number | null = null;
  private _y: number | null = null;
  private _externalX: number | null = null;
  private _visible = false;
  private _measureEnabled = false;
  private _measuring = false;
  private _measureStartX: number | null = null;
  private _measureStartY: number | null = null;

  constructor(
    private _viewport: Viewport,
    private _dataManager: DataManager,
    private _config: CrosshairConfig,
    private _requestDraw: () => void,
    private _onCrosshairMove?: (x: number | null) => void,
  ) { }

  get crosshairX(): number | null { return this._x; }
  get crosshairY(): number | null { return this._y; }
  get visible(): boolean { return this._visible; }
  get measureEnabled(): boolean { return this._measureEnabled; }

  setOnCrosshairMove(cb: ((x: number | null) => void) | null): void {
    this._onCrosshairMove = cb ?? undefined;
  }

  setConfig(config: CrosshairConfig): void {
    this._config = config;
  }

  /**
   * Set an externally-driven crosshair X pixel (bar-center-snapped).
   * When set, this overrides the raw pointer X for the vertical line.
   * Pass null to clear the external override.
   */
  setExternalX(x: number | null): void {
    this._externalX = x;
    this._requestDraw();
  }

  setMeasureEnabled(enabled: boolean): void {
    this._measureEnabled = enabled;
    if (!enabled) {
      this._measuring = false;
      this._measureStartX = null;
      this._measureStartY = null;
    }
    this._requestDraw();
  }

  onEvent(event: InputEvent): boolean {
    if (!this._config.enabled) return false;

    switch (event.type) {
      case 'pointerdown': {
        if (!this._measureEnabled || event.button !== 0) return false;
        const inChart = event.x < this._viewport.chartWidth && event.y < this._viewport.chartHeight;
        if (!inChart) return false;
        this._measureStartX = event.x;
        this._measureStartY = event.y;
        this._x = event.x;
        this._y = event.y;
        this._visible = true;
        this._measuring = true;
        this._requestDraw();
        return true;
      }
      case 'pointermove': {
        const inChart = event.x < this._viewport.chartWidth && event.y < this._viewport.chartHeight;
        if (inChart) {
          // Snap x to bar centre (unless measuring, where raw precision matters).
          if (!this._measuring) {
            const totalBars = this._dataManager.getTotalBars();
            if (totalBars > 0) {
              const barIdx = Math.max(0, Math.min(totalBars - 1, this._viewport.xToBarIndex(event.x, totalBars)));
              this._x = this._viewport.barIndexToX(barIdx, totalBars);
            } else {
              this._x = event.x;
            }
          } else {
            this._x = event.x;
          }
          this._y = event.y;
          this._visible = true;
          this._onCrosshairMove?.(this._x);
          this._requestDraw();
        } else if (this._visible) {
          this._visible = false;
          this._onCrosshairMove?.(null);
          this._requestDraw();
        }
        return this._measureEnabled ? this._measuring : false;
      }
      case 'pointerup':
        if (this._measuring) {
          this._measuring = false;
          this._requestDraw();
          return true;
        }
        return false;
      case 'pointerleave':
        if (this._visible) {
          this._visible = false;
          this._measuring = false;
          this._onCrosshairMove?.(null);
          this._requestDraw();
        }
        return false;
      default:
        return false;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    theme: Theme,
  ): void {
    // Allow external-driven crosshair (from hovering indicator panels)
    const hasExternal = this._externalX !== null;
    const hasLocal = this._visible && this._x !== null && this._y !== null;

    if (!hasLocal && !hasExternal) return;

    const chartW = viewport.chartWidth;
    const chartH = viewport.chartHeight;

    // When pointer is on this chart: follow mouse exactly (no snapping gap).
    // When driven externally (indicator panel hovered): use the external raw pixel X.
    const drawX = hasLocal ? this._x! : (this._externalX ?? this._x!);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = theme.colors.crosshair;
    ctx.lineWidth = 1;

    // Vertical line (always drawn when either local or external crosshair is active)
    ctx.beginPath();
    ctx.moveTo(drawX, 0);
    ctx.lineTo(drawX, chartH);
    ctx.stroke();

    // Horizontal line, price label and time label only shown when pointer is on this chart
    if (!hasLocal) {
      ctx.setLineDash([]);
      return;
    }

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, this._y!);
    ctx.lineTo(chartW, this._y!);
    ctx.stroke();

    ctx.setLineDash([]);

    // Price label on right scale
    if (this._config.showPriceLabel) {
      const price = viewport.yToPrice(this._y!);
      const decimals = this._getDecimals(viewport);
      const text = price.toFixed(decimals);
      const fontSize = theme.fontSize + 1;
      ctx.font = `${fontSize}px ${theme.fontFamily}`;
      const tw = ctx.measureText(text).width;
      const labelW = tw + 10;
      const labelH = fontSize + 8;

      ctx.fillStyle = theme.colors.crosshairLabel;
      ctx.fillRect(chartW, this._y! - labelH / 2, labelW, labelH);
      ctx.fillStyle = theme.colors.crosshairLabelText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, chartW + 5, this._y!);
    }

    // Time label on bottom scale
    if (this._config.showTimeLabel) {
      const totalBars = dataManager.getTotalBars();
      if (totalBars > 0) {
        const barIndex = viewport.xToBarIndex(drawX, totalBars);
        const time = dataManager.getTimeAtIndex(Math.max(0, Math.min(barIndex, totalBars - 1)));
        if (time !== null) {
          const text = formatDateTime(time);
          const fontSize = theme.fontSize + 1;
          ctx.font = `${fontSize}px ${theme.fontFamily}`;
          const tw = ctx.measureText(text).width;
          const labelW = tw + 10;
          const labelH = fontSize + 8;

          ctx.fillStyle = theme.colors.crosshairLabel;
          ctx.fillRect(drawX - labelW / 2, chartH, labelW, labelH);
          ctx.fillStyle = theme.colors.crosshairLabelText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(text, drawX, chartH + 4);
        }
      }
    }

    // Crosshair measurement line (drag from start to current pointer)
    if (
      this._measureEnabled &&
      this._measureStartX !== null &&
      this._measureStartY !== null &&
      this._x !== null &&
      this._y !== null
    ) {
      this._drawMeasurement(ctx, viewport, dataManager, theme);
    }
  }

  private _getDecimals(viewport: Viewport): number {
    const range = viewport.priceMax - viewport.priceMin;
    if (range === 0) return 2;
    if (range < 0.01) return 5;
    if (range < 1) return 4;
    if (range < 10) return 3;
    if (range < 1000) return 2;
    return 0;
  }

  private _drawMeasurement(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    theme: Theme,
  ): void {
    const sx = this._measureStartX!;
    const sy = this._measureStartY!;
    const ex = this._x!;
    const ey = this._y!;

    ctx.strokeStyle = theme.colors.crosshair;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.fillStyle = theme.colors.crosshair;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const totalBars = dataManager.getTotalBars();
    if (totalBars <= 0) return;

    const startBar = viewport.xToBarIndex(sx, totalBars);
    const endBar = viewport.xToBarIndex(ex, totalBars);
    const startPrice = viewport.yToPrice(sy);
    const endPrice = viewport.yToPrice(ey);
    const priceDiff = endPrice - startPrice;
    const pct = startPrice !== 0 ? (priceDiff / startPrice) * 100 : 0;
    const barsDiff = endBar - startBar;

    const decimals = this._getDecimals(viewport);
    const priceText = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(decimals)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
    const barsText = `${barsDiff >= 0 ? '+' : ''}${barsDiff} bars`;
    const text = `${priceText}  ${barsText}`;

    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    ctx.font = `${theme.fontSize + 1}px ${theme.fontFamily}`;
    const tw = ctx.measureText(text).width;
    const th = theme.fontSize + 8;
    const pad = 4;

    ctx.fillStyle = theme.colors.crosshairLabel;
    ctx.fillRect(mx - tw / 2 - pad, my - th - 6, tw + pad * 2, th);
    ctx.fillStyle = theme.colors.crosshairLabelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mx, my - th / 2 - 6);
  }
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}
