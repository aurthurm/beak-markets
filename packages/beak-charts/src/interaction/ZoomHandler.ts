import type { InputHandler, InputEvent } from './EventRouter.ts';
import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';

export class ZoomHandler implements InputHandler {
  priority = 20;

  constructor(
    private _viewport: Viewport,
    private _dataManager: DataManager,
    private _requestDraw: () => void,
  ) {}

  onEvent(event: InputEvent): boolean {
    if (event.type !== 'wheel') return false;

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;

    if (event.shiftKey) {
      // Shift+wheel: zoom Y axis (price)
      this._viewport.zoomY(zoomFactor);
    } else {
      // Normal wheel: zoom X axis (time)
      this._viewport.zoomX(zoomFactor, event.x, this._dataManager.getTotalBars());
    }

    this._requestDraw();
    return true;
  }
}
