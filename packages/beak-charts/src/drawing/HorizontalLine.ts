import { BaseTool } from './BaseTool.ts';
import type { DrawingConfig } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class HorizontalLine extends BaseTool {
  constructor(config: DrawingConfig) {
    super(config);
  }

  get requiredAnchors(): number { return 2; }
  get constrainHorizontal(): boolean { return true; }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    _theme: Theme,
  ): void {
    void _theme;
    if (!this.config.visible || this.config.anchors.length === 0) return;

    const price = this.config.anchors[0]!.price;
    const y = viewport.priceToY(price);
    const totalBars = dataManager.getTotalBars();

    // Determine X span
    let x0 = 0;
    let x1 = viewport.chartWidth;
    if (this.config.anchors.length >= 2) {
      x0 = viewport.barIndexToX(this.config.anchors[0]!.barIndex, totalBars);
      x1 = viewport.barIndexToX(this.config.anchors[1]!.barIndex, totalBars);
      if (x0 > x1) { const tmp = x0; x0 = x1; x1 = tmp; }
    }

    ctx.beginPath();
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = this.config.lineWidth;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.font = '10px monospace';
    ctx.fillStyle = this.config.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(price.toFixed(4), Math.min(x0, x1) + 4, y - 10);

    this.drawHandles(ctx, viewport, dataManager);
  }

  hitTest(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): boolean {
    if (this.config.anchors.length === 0) return false;
    const lineY = viewport.priceToY(this.config.anchors[0]!.price);
    if (Math.abs(y - lineY) > 5) return false;

    if (this.config.anchors.length >= 2) {
      const totalBars = dataManager.getTotalBars();
      const x0 = viewport.barIndexToX(this.config.anchors[0]!.barIndex, totalBars);
      const x1 = viewport.barIndexToX(this.config.anchors[1]!.barIndex, totalBars);
      const left = Math.min(x0, x1) - 5;
      const right = Math.max(x0, x1) + 5;
      return x >= left && x <= right;
    }

    return true;
  }
}
