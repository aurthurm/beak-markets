import type { InputHandler, InputEvent } from './EventRouter.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';

export class PanHandler implements InputHandler {
  priority = 10;
  private _dragging = false;
  private _lastX = 0;
  private _enabled = true;

  constructor(
    private _viewport: Viewport,
    private _dataManager: DataManager,
    private _requestDraw: () => void,
  ) {}

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) this._dragging = false;
  }

  onEvent(event: InputEvent): boolean {
    if (!this._enabled) return false;

    switch (event.type) {
      case 'pointerdown':
        if (event.button === 0) {
          this._dragging = true;
          this._lastX = event.x;
        }
        return false; // don't consume - crosshair also needs pointer events

      case 'pointermove':
        if (this._dragging) {
          const dx = event.x - this._lastX;
          const barsDelta = dx / this._viewport.barSpacing;
          this._viewport.scrollBy(barsDelta);
          this._lastX = event.x;
          this._requestDraw();
          return true;
        }
        return false;

      case 'pointerup':
        if (this._dragging) {
          this._dragging = false;
          return true;
        }
        return false;

      default:
        return false;
    }
  }
}
