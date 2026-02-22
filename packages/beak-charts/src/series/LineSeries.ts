import { BaseSeries } from './BaseSeries.ts';
import type { Viewport, SubPaneViewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { LineDataPoint, LineSeriesOptions } from '../types.ts';
import type { Theme } from '../theme/types.ts';

const DEFAULTS: LineSeriesOptions = {
  color: '',
  lineWidth: 2,
  pointRadius: 0,
};

export class LineSeries extends BaseSeries {
  private opts: LineSeriesOptions;

  constructor(id: string, options: Partial<LineSeriesOptions> = {}, priceScaleId = 'right') {
    super(id, 'line', priceScaleId);
    this.opts = { ...DEFAULTS, ...options };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    _subPane: SubPaneViewport | null,
    dataManager: DataManager,
    theme: Theme,
  ): void {
    const { data, startIndex, endIndex } = this.getVisibleData(viewport, dataManager);
    if (data.length === 0) return;

    const totalBars = data.length;
    const color = this.opts.color || theme.colors.line;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = this.opts.lineWidth;

    let started = false;
    for (let i = startIndex; i <= endIndex && i < data.length; i++) {
      const point = data[i] as LineDataPoint;
      if (!point || !('value' in point)) continue;

      const x = viewport.barIndexToX(i, totalBars);
      const y = viewport.priceToY(point.value);

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Optional dots
    if (this.opts.pointRadius > 0) {
      ctx.fillStyle = color;
      for (let i = startIndex; i <= endIndex && i < data.length; i++) {
        const point = data[i] as LineDataPoint;
        if (!point || !('value' in point)) continue;
        const x = viewport.barIndexToX(i, totalBars);
        const y = viewport.priceToY(point.value);
        ctx.beginPath();
        ctx.arc(x, y, this.opts.pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
