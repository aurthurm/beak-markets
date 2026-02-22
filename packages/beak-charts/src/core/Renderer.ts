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

  constructor(canvas: HTMLCanvasElement, theme: Theme) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;
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

  addLayer(layer: DrawLayer): void {
    this._layers.push(layer);
    this._layers.sort((a, b) => a.zIndex - b.zIndex);
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
    this._needsDraw = false;

    if (this._onDraw) this._onDraw();

    const { width, height } = this._canvas;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this._ctx;

    ctx.save();
    ctx.scale(dpr, dpr);
    const w = width / dpr;
    const h = height / dpr;

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this._theme.colors.background;
    ctx.fillRect(0, 0, w, h);

    // Draw layers
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
  }
}
