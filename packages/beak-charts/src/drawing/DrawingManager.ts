import type { DrawingConfig, DrawingToolType } from '../types.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';
import { BaseTool } from './BaseTool.ts';
import { HorizontalLine } from './HorizontalLine.ts';
import { TrendLine } from './TrendLine.ts';
import { BoxDraw } from './BoxDraw.ts';
import { ArrowDraw } from './ArrowDraw.ts';
import { FibonacciRetracement } from './FibonacciRetracement.ts';

export class DrawingManager {
  private _drawings = new Map<string, BaseTool>();
  private _activeToolType: DrawingToolType | null = null;

  setActiveToolType(type: DrawingToolType | null): void {
    this._activeToolType = type;
  }

  getActiveToolType(): DrawingToolType | null {
    return this._activeToolType;
  }

  addDrawing(config: DrawingConfig): void {
    const tool = this._createTool(config);
    if (tool) this._drawings.set(config.id, tool);
  }

  removeDrawing(id: string): void {
    this._drawings.delete(id);
  }

  getDrawing(id: string): BaseTool | undefined {
    return this._drawings.get(id);
  }

  getAllDrawings(): BaseTool[] {
    return Array.from(this._drawings.values());
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    theme: Theme,
  ): void {
    for (const tool of this._drawings.values()) {
      tool.draw(ctx, viewport, dataManager, theme);
    }
  }

  hitTest(
    x: number,
    y: number,
    viewport: Viewport,
    dataManager: DataManager,
  ): BaseTool | null {
    for (const tool of this._drawings.values()) {
      if (tool.hitTest(x, y, viewport, dataManager)) return tool;
    }
    return null;
  }

  private _createTool(config: DrawingConfig): BaseTool | null {
    switch (config.type) {
      case 'horizontalLine':
        return new HorizontalLine(config);
      case 'trendLine':
        return new TrendLine(config);
      case 'box':
        return new BoxDraw(config);
      case 'arrow':
      case 'arrowUp':
      case 'arrowDown':
        return new ArrowDraw(config);
      case 'fibonacci':
        return new FibonacciRetracement(config);
      default:
        return null;
    }
  }
}
