import { BaseTool } from './BaseTool.ts';
import type { DrawingConfig } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class BoxDraw extends BaseTool {
  constructor(config: DrawingConfig) {
    super(config);
  }

  get requiredAnchors(): number { return 2; }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    _theme: Theme,
  ): void {
    void _theme;
    if (!this.config.visible || this.config.anchors.length < 2) return;

    const totalBars = dataManager.getTotalBars();
    const a0 = this.config.anchors[0]!;
    const a1 = this.config.anchors[1]!;

    const x0 = viewport.barIndexToX(a0.barIndex, totalBars);
    const y0 = viewport.priceToY(a0.price);
    const x1 = viewport.barIndexToX(a1.barIndex, totalBars);
    const y1 = viewport.priceToY(a1.price);

    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);

    // Fill
    ctx.fillStyle = this.config.color + '20';
    ctx.fillRect(left, top, w, h);

    // Border
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = this.config.lineWidth;
    ctx.strokeRect(left, top, w, h);

    this.drawHandles(ctx, viewport, dataManager);
  }

  hitTest(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): boolean {
    if (this.config.anchors.length < 2) return false;

    const totalBars = dataManager.getTotalBars();
    const a0 = this.config.anchors[0]!;
    const a1 = this.config.anchors[1]!;

    const x0 = viewport.barIndexToX(a0.barIndex, totalBars);
    const y0 = viewport.priceToY(a0.price);
    const x1 = viewport.barIndexToX(a1.barIndex, totalBars);
    const y1 = viewport.priceToY(a1.price);

    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);

    const onBorder =
      (x >= left - 5 && x <= right + 5 && (Math.abs(y - top) < 5 || Math.abs(y - bottom) < 5)) ||
      (y >= top - 5 && y <= bottom + 5 && (Math.abs(x - left) < 5 || Math.abs(x - right) < 5));

    return onBorder;
  }
}
