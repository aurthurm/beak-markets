import { BaseTool } from './BaseTool.ts';
import type { DrawingConfig } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class TrendLine extends BaseTool {
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

    ctx.beginPath();
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = this.config.lineWidth;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Anchor dots (always visible, handles drawn by base if selected)
    ctx.fillStyle = this.config.color;
    for (const [px, py] of [[x0, y0], [x1, y1]]) {
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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

    return distToSegment(x, y, x0, y0, x1, y1) < 5;
  }
}

function distToSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x0, py - y0);

  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x0 + t * dx;
  const projY = y0 + t * dy;
  return Math.hypot(px - projX, py - projY);
}
