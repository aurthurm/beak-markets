export type InputEvent =
  | { type: 'pointerdown'; x: number; y: number; button: number }
  | { type: 'pointermove'; x: number; y: number }
  | { type: 'pointerup'; x: number; y: number }
  | { type: 'wheel'; x: number; y: number; deltaX: number; deltaY: number; shiftKey: boolean }
  | { type: 'pointerleave' };

export type InputHandler = {
  priority: number;
  onEvent(event: InputEvent): boolean; // return true to consume
};

export class EventRouter {
  private _canvas: HTMLCanvasElement;
  private _handlers: InputHandler[] = [];
  private _boundPointerDown: (e: PointerEvent) => void;
  private _boundPointerMove: (e: PointerEvent) => void;
  private _boundPointerUp: (e: PointerEvent) => void;
  private _boundWheel: (e: WheelEvent) => void;
  private _boundPointerLeave: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;

    this._boundPointerDown = (e) => this._dispatch({
      type: 'pointerdown',
      x: e.offsetX,
      y: e.offsetY,
      button: e.button,
    });
    this._boundPointerMove = (e) => this._dispatch({
      type: 'pointermove',
      x: e.offsetX,
      y: e.offsetY,
    });
    this._boundPointerUp = (e) => this._dispatch({
      type: 'pointerup',
      x: e.offsetX,
      y: e.offsetY,
    });
    this._boundWheel = (e) => {
      e.preventDefault();
      this._dispatch({
        type: 'wheel',
        x: e.offsetX,
        y: e.offsetY,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        shiftKey: e.shiftKey,
      });
    };
    this._boundPointerLeave = () => this._dispatch({ type: 'pointerleave' });

    canvas.addEventListener('pointerdown', this._boundPointerDown);
    canvas.addEventListener('pointermove', this._boundPointerMove);
    canvas.addEventListener('pointerup', this._boundPointerUp);
    canvas.addEventListener('wheel', this._boundWheel, { passive: false });
    canvas.addEventListener('pointerleave', this._boundPointerLeave);
  }

  addHandler(handler: InputHandler): void {
    this._handlers.push(handler);
    this._handlers.sort((a, b) => b.priority - a.priority);
  }

  removeHandler(handler: InputHandler): void {
    const idx = this._handlers.indexOf(handler);
    if (idx !== -1) this._handlers.splice(idx, 1);
  }

  private _dispatch(event: InputEvent): void {
    for (const handler of this._handlers) {
      if (handler.onEvent(event)) break;
    }
  }

  destroy(): void {
    this._canvas.removeEventListener('pointerdown', this._boundPointerDown);
    this._canvas.removeEventListener('pointermove', this._boundPointerMove);
    this._canvas.removeEventListener('pointerup', this._boundPointerUp);
    this._canvas.removeEventListener('wheel', this._boundWheel);
    this._canvas.removeEventListener('pointerleave', this._boundPointerLeave);
    this._handlers = [];
  }
}
