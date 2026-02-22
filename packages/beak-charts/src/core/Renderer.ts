import type { Theme } from '../theme/types.ts';

export type DrawLayer = {
  zIndex: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, theme: Theme) => void;
};

export class Renderer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _layers: DrawLayer[] = [];
  private _rafId: number | null = null;
  private _needsDraw = true;
  private _theme: Theme;
  private _onDraw: (() => void) | null = null;
  private _getIsVisible: (() => boolean) | null = null;

  constructor(canvas: HTMLCanvasElement, theme: Theme) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    })!;
    this._theme = theme;
  }

  get ctx(): CanvasRenderingContext2D { return this._ctx; }
  get canvas(): HTMLCanvasElement { return this._canvas; }

  setTheme(theme: Theme): void {
    this._theme = theme;
    this.requestDraw();
  }

  setOnDraw(cb: () => void): void {
    this._onDraw = cb;
  }

  setVisibleCheck(getIsVisible: () => boolean): void {
    this._getIsVisible = getIsVisible;
  }

  addLayer(layer: DrawLayer): void {
    const insert = this._layers.findIndex((l) => l.zIndex > layer.zIndex);
    if (insert === -1) this._layers.push(layer);
    else this._layers.splice(insert, 0, layer);
    this.requestDraw();
  }

  removeLayer(layer: DrawLayer): void {
    const idx = this._layers.indexOf(layer);
    if (idx !== -1) this._layers.splice(idx, 1);
  }

  clearLayers(): void {
    this._layers = [];
  }

  requestDraw(): void {
    this._needsDraw = true;
    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(() => this._draw());
    }
  }

  private _draw(): void {
    this._rafId = null;
    if (!this._needsDraw) return;
    if (this._getIsVisible && !this._getIsVisible()) {
      this._needsDraw = false;
      return;
    }
    this._needsDraw = false;

    if (this._onDraw) this._onDraw();

    const { width, height } = this._canvas;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this._ctx;
    const w = width / dpr;
    const h = height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this._theme.colors.background;
    ctx.fillRect(0, 0, w, h);

    for (const layer of this._layers) {
      ctx.save();
      layer.draw(ctx, w, h, this._theme);
      ctx.restore();
    }

    ctx.restore();
  }

  resize(w: number, h: number): void {
    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
    this._canvas.style.width = `${w}px`;
    this._canvas.style.height = `${h}px`;
    this.requestDraw();
  }

  destroy(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._layers = [];
    this._onDraw = null;
    this._getIsVisible = null;
  }
}
