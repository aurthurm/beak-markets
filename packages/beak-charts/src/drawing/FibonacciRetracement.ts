import { BaseTool } from './BaseTool.ts';
import type { DrawingConfig } from '../types.ts';
import { DEFAULT_FIB_LEVELS } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class FibonacciRetracement extends BaseTool {
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
    const x1 = viewport.barIndexToX(a1.barIndex, totalBars);
    const left  = Math.min(x0, x1);
    const right = Math.max(x0, x1);

    // Directional: level 0 = a0 (start), level 1 = a1 (end)
    const priceRange = a1.price - a0.price;

    // Sort by ratio so bands and lines are always drawn in correct order
    const allLevels  = [...(this.config.fibLevels ?? DEFAULT_FIB_LEVELS)].sort((a, b) => a.ratio - b.ratio);
    const visible    = allLevels.filter(l => l.visible);

    ctx.save();
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';

    // Filled bands between consecutive visible levels
    for (let i = 0; i < visible.length - 1; i++) {
      const price0  = a0.price + priceRange * visible[i]!.ratio;
      const price1  = a0.price + priceRange * visible[i + 1]!.ratio;
      const y0      = viewport.priceToY(price0);
      const y1      = viewport.priceToY(price1);
      ctx.fillStyle = `${this.config.color}12`;
      ctx.fillRect(left, Math.min(y0, y1), right - left, Math.abs(y1 - y0));
    }

    // Lines + labels for each visible level
    const minRatio = allLevels[0]?.ratio ?? 0;
    const maxRatio = allLevels[allLevels.length - 1]?.ratio ?? 1;

    for (const { ratio, label } of visible) {
      const price  = a0.price + priceRange * ratio;
      const y      = viewport.priceToY(price);
      const isEdge = ratio === minRatio || ratio === maxRatio;

      ctx.beginPath();
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth   = isEdge ? this.config.lineWidth + 0.5 : this.config.lineWidth;
      ctx.globalAlpha = isEdge ? 0.85 : 0.65;
      ctx.setLineDash(isEdge ? [] : [4, 3]);
      ctx.moveTo(left,  y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.fillStyle = this.config.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${label}  ${price.toFixed(4)}`, right + 5, y);
    }

    // Thin vertical edge guides spanning the full range
    const yTop    = viewport.priceToY(Math.max(a0.price, a1.price));
    const yBottom = viewport.priceToY(Math.min(a0.price, a1.price));
    ctx.beginPath();
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth   = this.config.lineWidth;
    ctx.globalAlpha = 0.25;
    ctx.moveTo(x0, yTop);    ctx.lineTo(x0, yBottom);
    ctx.moveTo(x1, yTop);    ctx.lineTo(x1, yBottom);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
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

    const x0    = viewport.barIndexToX(a0.barIndex, totalBars);
    const x1    = viewport.barIndexToX(a1.barIndex, totalBars);
    const left  = Math.min(x0, x1) - 5;
    const right = Math.max(x0, x1) + 5;

    if (x < left || x > right) return false;

    const priceRange = a1.price - a0.price;
    const levels     = (this.config.fibLevels ?? DEFAULT_FIB_LEVELS).filter(l => l.visible);

    for (const { ratio } of levels) {
      const price = a0.price + priceRange * ratio;
      if (Math.abs(y - viewport.priceToY(price)) < 5) return true;
    }
    return false;
  }
}
