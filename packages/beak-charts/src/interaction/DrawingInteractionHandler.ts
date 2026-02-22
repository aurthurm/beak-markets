import type { InputHandler, InputEvent } from './EventRouter.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { DrawingToolType, DrawingAnchor } from '../types.ts';
import { DrawingManager } from '../drawing/DrawingManager.ts';
import type { BaseTool, HandleHit } from '../drawing/BaseTool.ts';
import type { Theme } from '../theme/types.ts';

export type InteractionMode = 'select' | DrawingToolType | null;

export type DrawingChangeCallback = (event: DrawingChangeEvent) => void;
export type DrawingChangeEvent =
  | { type: 'placed'; drawingId: string }
  | { type: 'selected'; drawingId: string | null }
  | { type: 'moved'; drawingId: string }
  | { type: 'deleted'; drawingId: string };

type PlacementState = {
  toolType: DrawingToolType;
  anchors: DrawingAnchor[];
  previewAnchor: DrawingAnchor | null;
  drawingId: string;
};

type DragState = {
  tool: BaseTool;
  handle: HandleHit | null; // null = dragging whole drawing
  startBarIndex: number;
  startPrice: number;
  origAnchors: DrawingAnchor[];
};

let _nextDrawingId = 0;

export class DrawingInteractionHandler implements InputHandler {
  priority = 30; // highest - intercepts clicks when in drawing/select mode

  private _mode: InteractionMode = null;
  private _placement: PlacementState | null = null;
  private _drag: DragState | null = null;
  private _selectedId: string | null = null;
  private _onChange: DrawingChangeCallback | null = null;

  // Drawing defaults
  private _colors: Record<DrawingToolType, string> = {
    horizontalLine: '#f59e0b',
    trendLine: '#06b6d4',
    box: '#8b5cf6',
    arrow: '#06b6d4',
    arrowUp: '#22c55e',
    arrowDown: '#ef4444',
  };

  constructor(
    private _viewport: Viewport,
    private _dataManager: DataManager,
    private _drawingManager: DrawingManager,
    private _canvas: HTMLCanvasElement,
    private _requestDraw: () => void,
  ) {}

  get mode(): InteractionMode { return this._mode; }
  get selectedDrawingId(): string | null { return this._selectedId; }
  get isPlacing(): boolean { return this._placement !== null; }

  setMode(mode: InteractionMode): void {
    // Cancel any in-progress placement
    if (this._placement) {
      this._drawingManager.removeDrawing(this._placement.drawingId);
      this._placement = null;
    }
    if (mode !== 'select' && this._selectedId) {
      this._selectDrawing(null);
    }
    this._mode = mode;
    this._updateCursor();
    this._requestDraw();
  }

  setOnChange(cb: DrawingChangeCallback | null): void {
    this._onChange = cb;
  }

  deleteSelected(): void {
    if (this._selectedId) {
      this._drawingManager.removeDrawing(this._selectedId);
      const id = this._selectedId;
      this._selectDrawing(null);
      this._onChange?.({ type: 'deleted', drawingId: id });
      this._requestDraw();
    }
  }

  onEvent(event: InputEvent): boolean {
    // Only intercept when we have an active mode
    if (this._mode === null) return false;

    switch (event.type) {
      case 'pointerdown':
        if (event.button !== 0) return false;
        return this._onPointerDown(event.x, event.y);
      case 'pointermove':
        return this._onPointerMove(event.x, event.y);
      case 'pointerup':
        return this._onPointerUp();
      default:
        return false;
    }
  }

  /** Draw the in-progress placement preview. Called from Chart's drawing layer. */
  drawPreview(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    _theme: Theme,
  ): void {
    void _theme;
    const p = this._placement;
    if (!p || p.anchors.length === 0 || !p.previewAnchor) return;

    const totalBars = dataManager.getTotalBars();
    const a0 = p.anchors[0]!;
    const x0 = viewport.barIndexToX(a0.barIndex, totalBars);
    const y0 = viewport.priceToY(a0.price);

    const previewAnchor = this._applyConstraints(p.toolType, a0, p.previewAnchor);
    const x1 = viewport.barIndexToX(previewAnchor.barIndex, totalBars);
    const y1 = viewport.priceToY(previewAnchor.price);

    const color = this._colors[p.toolType];

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    if (p.toolType === 'horizontalLine') {
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (p.toolType === 'trendLine') {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (p.toolType === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      const angle = Math.atan2(y1 - y0, x1 - x0);
      const headLength = 11;
      const headAngle = Math.PI / 7;
      ctx.fillStyle = color;
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
    } else if (p.toolType === 'arrowUp' || p.toolType === 'arrowDown') {
      const size = 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (p.toolType === 'arrowUp') {
        ctx.moveTo(x0, y0 - size);
        ctx.lineTo(x0 - size, y0 + size);
        ctx.lineTo(x0 + size, y0 + size);
      } else {
        ctx.moveTo(x0, y0 + size);
        ctx.lineTo(x0 - size, y0 - size);
        ctx.lineTo(x0 + size, y0 - size);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.toolType === 'box') {
      const left = Math.min(x0, x1);
      const top = Math.min(y0, y1);
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      ctx.fillStyle = color + '15';
      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left, top, w, h);
    }

    // Anchor dots
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0, y0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Private ──

  private _onPointerDown(x: number, y: number): boolean {
    // Outside chart area? ignore
    if (x >= this._viewport.chartWidth || y >= this._viewport.chartHeight) return false;

    const anchor = this._pixelToAnchor(x, y);

    // Drawing placement mode
    if (this._mode !== 'select' && this._mode !== null) {
      return this._handlePlacementClick(anchor);
    }

    // Select mode
    if (this._mode === 'select') {
      return this._handleSelectDown(x, y, anchor);
    }

    return false;
  }

  private _onPointerMove(x: number, y: number): boolean {
    // Handle drag
    if (this._drag) {
      this._handleDragMove(x, y);
      return true;
    }

    // Placement preview
    if (this._placement && this._placement.anchors.length > 0) {
      this._placement.previewAnchor = this._pixelToAnchor(x, y);
      this._requestDraw();
      return true; // consume to prevent pan
    }

    // Select mode: update cursor based on what's under pointer
    if (this._mode === 'select') {
      this._updateSelectCursor(x, y);
      return false; // allow pan/crosshair handlers to continue receiving events
    }

    return false;
  }

  private _onPointerUp(): boolean {
    if (this._drag) {
      this._onChange?.({ type: 'moved', drawingId: this._drag.tool.config.id });
      this._drag = null;
      this._updateCursor();
      this._requestDraw();
      return true;
    }
    return false;
  }

  private _handlePlacementClick(anchor: DrawingAnchor): boolean {
    const toolType = this._mode as DrawingToolType;
    const requiredAnchors = this._requiredAnchorsForTool(toolType);

    if (!this._placement) {
      // One-click tools place immediately.
      if (requiredAnchors <= 1) {
        const id = `drawing_${_nextDrawingId++}`;
        this._drawingManager.addDrawing({
          id,
          type: toolType,
          anchors: [anchor],
          color: this._colors[toolType],
          lineWidth: toolType === 'arrow' ? 2 : 1,
          visible: true,
        });
        this._onChange?.({ type: 'placed', drawingId: id });
        this._requestDraw();
        return true;
      }

      // First click - start placement
      const id = `drawing_${_nextDrawingId++}`;
      this._placement = {
        toolType,
        anchors: [anchor],
        previewAnchor: anchor,
        drawingId: id,
      };
      this._requestDraw();
      return true;
    }

    // Second click - finalize
    const p = this._placement;
    const requiredAnchorsForPlacement = this._requiredAnchorsForTool(p.toolType);
    const finalAnchor = this._applyConstraints(p.toolType, p.anchors[0]!, anchor);
    const anchors = requiredAnchorsForPlacement <= 1 ? [p.anchors[0]!] : [p.anchors[0]!, finalAnchor];

    this._drawingManager.addDrawing({
      id: p.drawingId,
      type: p.toolType,
      anchors,
      color: this._colors[p.toolType],
      lineWidth: p.toolType === 'trendLine' || p.toolType === 'arrow' ? 2 : 1,
      visible: true,
    });

    const id = p.drawingId;
    this._placement = null;
    this._onChange?.({ type: 'placed', drawingId: id });
    this._requestDraw();

    // Stay in the same tool mode for rapid drawing, user can switch to select
    return true;
  }

  private _handleSelectDown(x: number, y: number, anchor: DrawingAnchor): boolean {
    // Check if clicking on a handle of the selected drawing
    if (this._selectedId) {
      const tool = this._drawingManager.getDrawing(this._selectedId);
      if (tool) {
        const handle = tool.hitTestHandle(x, y, this._viewport, this._dataManager);
        if (handle) {
          this._startDrag(tool, handle, anchor);
          return true;
        }
      }
    }

    // Check if clicking on any drawing
    const hit = this._drawingManager.hitTest(x, y, this._viewport, this._dataManager);
    if (hit) {
      this._selectDrawing(hit.config.id);
      // Start whole-drawing drag
      this._startDrag(hit, null, anchor);
      return true;
    }

    // Click on empty space - deselect
    if (this._selectedId) {
      this._selectDrawing(null);
      this._requestDraw();
    }
    return false; // allow empty-space drag to pan chart
  }

  private _startDrag(tool: BaseTool, handle: HandleHit | null, anchor: DrawingAnchor): void {
    this._selectDrawing(tool.config.id);
    this._drag = {
      tool,
      handle,
      startBarIndex: anchor.barIndex,
      startPrice: anchor.price,
      origAnchors: tool.config.anchors.map((a) => ({ ...a })),
    };
    this._canvas.style.cursor = handle ? 'grab' : 'move';
  }

  private _handleDragMove(x: number, y: number): void {
    const d = this._drag!;
    const current = this._pixelToAnchor(x, y);

    if (d.handle !== null) {
      // Drag single anchor handle
      let newAnchor = current;
      if (d.tool.constrainHorizontal) {
        // H-line: keep price of anchor[0]
        newAnchor = { barIndex: current.barIndex, price: d.origAnchors[0]!.price };
      }
      d.tool.moveAnchor(d.handle.anchorIndex, newAnchor);
    } else {
      // Drag whole drawing
      const barDelta = current.barIndex - d.startBarIndex;
      const priceDelta = current.price - d.startPrice;
      for (let i = 0; i < d.origAnchors.length; i++) {
        d.tool.config.anchors[i] = {
          barIndex: d.origAnchors[i]!.barIndex + barDelta,
          price: d.origAnchors[i]!.price + priceDelta,
        };
      }
    }

    this._requestDraw();
  }

  private _selectDrawing(id: string | null): void {
    // Deselect previous
    if (this._selectedId) {
      const prev = this._drawingManager.getDrawing(this._selectedId);
      if (prev) prev.selected = false;
    }
    this._selectedId = id;
    if (id) {
      const tool = this._drawingManager.getDrawing(id);
      if (tool) tool.selected = true;
    }
    this._onChange?.({ type: 'selected', drawingId: id });
  }

  private _pixelToAnchor(x: number, y: number): DrawingAnchor {
    const totalBars = this._dataManager.getTotalBars();
    return {
      barIndex: this._viewport.xToBarIndex(x, totalBars),
      price: this._viewport.yToPrice(y),
    };
  }

  private _applyConstraints(
    toolType: DrawingToolType,
    firstAnchor: DrawingAnchor,
    secondAnchor: DrawingAnchor,
  ): DrawingAnchor {
    if (toolType === 'horizontalLine') {
      return { barIndex: secondAnchor.barIndex, price: firstAnchor.price };
    }
    return secondAnchor;
  }

  private _requiredAnchorsForTool(toolType: DrawingToolType): number {
    if (toolType === 'arrowUp' || toolType === 'arrowDown') return 1;
    return 2;
  }

  private _updateCursor(): void {
    if (this._mode === 'select') {
      this._canvas.style.cursor = 'default';
    } else if (this._mode) {
      this._canvas.style.cursor = 'crosshair';
    }
  }

  private _updateSelectCursor(x: number, y: number): void {
    // Handle hover
    if (this._selectedId) {
      const tool = this._drawingManager.getDrawing(this._selectedId);
      if (tool) {
        const handle = tool.hitTestHandle(x, y, this._viewport, this._dataManager);
        if (handle) {
          this._canvas.style.cursor = 'grab';
          return;
        }
      }
    }
    // Drawing hover
    const hit = this._drawingManager.hitTest(x, y, this._viewport, this._dataManager);
    this._canvas.style.cursor = hit ? 'move' : 'default';
  }
}
