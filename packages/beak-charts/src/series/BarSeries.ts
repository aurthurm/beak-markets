import { BaseSeries } from './BaseSeries.ts';
import type { Viewport, SubPaneViewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { OHLCV, BarSeriesOptions } from '../types.ts';
import type { Theme } from '../theme/types.ts';

const DEFAULTS: BarSeriesOptions = {
  upColor: '',
  downColor: '',
  thinBars: false,
};

export class BarSeries extends BaseSeries {
  private opts: BarSeriesOptions;

  constructor(id: string, options: Partial<BarSeriesOptions> = {}, priceScaleId = 'right') {
    super(id, 'bar', priceScaleId);
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
    const tickWidth = Math.max(1, viewport.barSpacing * 0.3);
    const upColor = this.opts.upColor || theme.colors.candleUp;
    const downColor = this.opts.downColor || theme.colors.candleDown;

    for (let i = startIndex; i <= endIndex && i < data.length; i++) {
      const bar = data[i] as OHLCV;
      if (!bar || !('open' in bar)) continue;

      const x = viewport.barIndexToX(i, totalBars);
      const isUp = bar.close >= bar.open;
      const color = isUp ? upColor : downColor;

      const highY = viewport.priceToY(bar.high);
      const lowY = viewport.priceToY(bar.low);
      const openY = viewport.priceToY(bar.open);
      const closeY = viewport.priceToY(bar.close);

      ctx.strokeStyle = color;
      ctx.lineWidth = this.opts.thinBars ? 1 : 1.5;

      // Vertical line (high to low)
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Open tick (left)
      ctx.beginPath();
      ctx.moveTo(x - tickWidth, openY);
      ctx.lineTo(x, openY);
      ctx.stroke();

      // Close tick (right)
      ctx.beginPath();
      ctx.moveTo(x, closeY);
      ctx.lineTo(x + tickWidth, closeY);
      ctx.stroke();
    }
  }
}
