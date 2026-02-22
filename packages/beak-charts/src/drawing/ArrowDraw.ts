import { BaseTool } from './BaseTool.ts';
import type { DrawingConfig } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class ArrowDraw extends BaseTool {
  constructor(config: DrawingConfig) {
    super(config);
  }

  get requiredAnchors(): number {
    return this.config.type === 'arrow' ? 2 : 1;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    _theme: Theme,
  ): void {
    void _theme;
    if (!this.config.visible || this.config.anchors.length === 0) return;

    const totalBars = dataManager.getTotalBars();
    const a0 = this.config.anchors[0]!;
    const x0 = viewport.barIndexToX(a0.barIndex, totalBars);
    const y0 = viewport.priceToY(a0.price);

    if (this.config.type === 'arrowUp' || this.config.type === 'arrowDown') {
      drawArrowMarker(ctx, x0, y0, this.config.color, this.config.type);
      this.drawHandles(ctx, viewport, dataManager);
      return;
    }

    if (this.config.anchors.length < 2) return;

    const a1 = this.config.anchors[1]!;
    const x1 = viewport.barIndexToX(a1.barIndex, totalBars);
    const y1 = viewport.priceToY(a1.price);

    ctx.save();
    ctx.strokeStyle = this.config.color;
    ctx.fillStyle = this.config.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Fixed stroke width shaft + rotatable arrow head.
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const angle = Math.atan2(y1 - y0, x1 - x0);
    const headLength = 12;
    const headAngle = Math.PI / 7;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(
      x1 - headLength * Math.cos(angle - headAngle),
      y1 - headLength * Math.sin(angle - headAngle),
    );
    ctx.lineTo(
      x1 - headLength * Math.cos(angle + headAngle),
      y1 - headLength * Math.sin(angle + headAngle),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.drawHandles(ctx, viewport, dataManager);
  }

  hitTest(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): boolean {
    if (this.config.anchors.length === 0) return false;

    const totalBars = dataManager.getTotalBars();
    const a0 = this.config.anchors[0]!;
    const x0 = viewport.barIndexToX(a0.barIndex, totalBars);
    const y0 = viewport.priceToY(a0.price);

    if (this.config.type === 'arrowUp' || this.config.type === 'arrowDown') {
      return Math.hypot(x - x0, y - y0) < 10;
    }

    if (this.config.anchors.length < 2) return false;
    const a1 = this.config.anchors[1]!;
    const x1 = viewport.barIndexToX(a1.barIndex, totalBars);
    const y1 = viewport.priceToY(a1.price);
    return distToSegment(x, y, x0, y0, x1, y1) < 6;
  }
}

function drawArrowMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  type: 'arrowUp' | 'arrowDown',
): void {
  const size = 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (type === 'arrowUp') {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x + size, y + size);
  } else {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
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
