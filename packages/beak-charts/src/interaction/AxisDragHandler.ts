import type { InputHandler, InputEvent } from './EventRouter.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';

type HitZone = 'xAxis' | 'yAxis' | 'chart' | 'none';

export class AxisDragHandler implements InputHandler {
  priority = 25; // higher than zoom (20) so axis drags are caught first

  private _dragging: 'x' | 'y' | null = null;
  private _lastX = 0;
  private _lastY = 0;
  private _currentZone: HitZone = 'none';
  private _chartCursor = 'crosshair';

  constructor(
    private _viewport: Viewport,
    private _dataManager: DataManager,
    private _canvas: HTMLCanvasElement,
    private _requestDraw: () => void,
  ) {}

  setChartCursor(cursor: string): void {
    this._chartCursor = cursor;
    if (!this._dragging && this._currentZone === 'chart') {
      this._canvas.style.cursor = cursor;
    }
  }

  onEvent(event: InputEvent): boolean {
    switch (event.type) {
      case 'pointermove':
        return this._onPointerMove(event.x, event.y);

      case 'pointerdown':
        return this._onPointerDown(event.x, event.y, event.button);

      case 'pointerup':
        return this._onPointerUp();

      case 'pointerleave':
        return this._onPointerLeave();

      default:
        return false;
    }
  }

  private _hitTest(x: number, y: number): HitZone {
    const chartW = this._viewport.chartWidth;
    const chartH = this._viewport.chartHeight;

    if (y >= chartH && x < chartW) return 'xAxis';
    if (x >= chartW && y < chartH) return 'yAxis';
    if (x < chartW && y < chartH) return 'chart';
    return 'none';
  }

  private _onPointerMove(x: number, y: number): boolean {
    // If actively dragging an axis, handle zoom
    if (this._dragging === 'x') {
      const dx = x - this._lastX;
      // Drag right = zoom out (show more bars), drag left = zoom in (show fewer bars)
      const sensitivity = 0.005;
      const factor = 1 - dx * sensitivity;
      this._viewport.zoomX(factor, this._viewport.chartWidth / 2, this._dataManager.getTotalBars());
      this._lastX = x;
      this._lastY = y;
      this._requestDraw();
      return true;
    }

    if (this._dragging === 'y') {
      const dy = y - this._lastY;
      // Drag up = zoom in (compress range), drag down = zoom out (expand range)
      const sensitivity = 0.005;
      const factor = 1 - dy * sensitivity;
      this._viewport.zoomY(factor);
      this._lastX = x;
      this._lastY = y;
      this._requestDraw();
      return true;
    }

    // Not dragging - update cursor based on hover zone
    const zone = this._hitTest(x, y);
    if (zone !== this._currentZone) {
      this._currentZone = zone;
      this._updateCursor(zone);
    }

    return false; // don't consume - let crosshair and others see the move
  }

  private _onPointerDown(x: number, y: number, button: number): boolean {
    if (button !== 0) return false;

    const zone = this._hitTest(x, y);

    if (zone === 'xAxis') {
      this._dragging = 'x';
      this._lastX = x;
      this._lastY = y;
      this._canvas.style.cursor = 'ew-resize';
      return true; // consume so pan handler doesn't activate
    }

    if (zone === 'yAxis') {
      this._dragging = 'y';
      this._lastX = x;
      this._lastY = y;
      this._canvas.style.cursor = 'ns-resize';
      return true;
    }

    return false;
  }

  private _onPointerUp(): boolean {
    if (this._dragging) {
      this._dragging = null;
      this._updateCursor(this._currentZone);
      return true;
    }
    return false;
  }

  private _onPointerLeave(): boolean {
    if (this._dragging) {
      this._dragging = null;
    }
    this._currentZone = 'none';
    this._canvas.style.cursor = this._chartCursor;
    return false;
  }

  private _updateCursor(zone: HitZone): void {
    switch (zone) {
      case 'xAxis':
        this._canvas.style.cursor = 'ew-resize';
        break;
      case 'yAxis':
        this._canvas.style.cursor = 'ns-resize';
        break;
      case 'chart':
        this._canvas.style.cursor = this._chartCursor;
        break;
      default:
        this._canvas.style.cursor = 'default';
        break;
    }
  }
}
