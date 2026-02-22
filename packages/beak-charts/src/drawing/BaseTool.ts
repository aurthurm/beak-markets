import type { DrawingConfig, DrawingAnchor } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export type HandleHit = {
  anchorIndex: number;
};

export abstract class BaseTool {
  config: DrawingConfig;
  selected = false;

  constructor(config: DrawingConfig) {
    this.config = config;
  }

  abstract draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    theme: Theme,
  ): void;

  abstract hitTest(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): boolean;

  /** Hit-test individual anchor handles. Returns the anchor index or null. */
  hitTestHandle(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): HandleHit | null {
    const totalBars = dataManager.getTotalBars();
    for (let i = 0; i < this.config.anchors.length; i++) {
      const a = this.config.anchors[i]!;
      const ax = viewport.barIndexToX(a.barIndex, totalBars);
      const ay = viewport.priceToY(a.price);
      if (Math.hypot(x - ax, y - ay) < 7) {
        return { anchorIndex: i };
      }
    }
    return null;
  }

  /** Move a single anchor to new data coordinates. */
  moveAnchor(index: number, anchor: DrawingAnchor): void {
    if (index >= 0 && index < this.config.anchors.length) {
      this.config.anchors[index] = anchor;
    }
  }

  /** Move all anchors by a delta. */
  moveAll(barDelta: number, priceDelta: number): void {
    for (const a of this.config.anchors) {
      a.barIndex += barDelta;
      a.price += priceDelta;
    }
  }

  /** Draw selection handles (squares at each anchor). */
  drawHandles(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
  ): void {
    if (!this.selected) return;
    const totalBars = dataManager.getTotalBars();
    const size = 5;

    for (const a of this.config.anchors) {
      const x = viewport.barIndexToX(a.barIndex, totalBars);
      const y = viewport.priceToY(a.price);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - size, y - size, size * 2, size * 2);
    }
  }

  /** How many anchors this tool needs for placement. */
  abstract get requiredAnchors(): number;

  /** Whether the horizontal line constrains second anchor to same price as first. */
  get constrainHorizontal(): boolean { return false; }
}
