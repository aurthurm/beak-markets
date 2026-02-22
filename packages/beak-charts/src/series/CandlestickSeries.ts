import { BaseSeries } from './BaseSeries.ts';
import type { Viewport, SubPaneViewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { OHLCV, CandlestickSeriesOptions } from '../types.ts';
import type { Theme } from '../theme/types.ts';

const DEFAULTS: CandlestickSeriesOptions = {
  upColor: '',
  downColor: '',
  wickUpColor: '',
  wickDownColor: '',
  borderUpColor: '',
  borderDownColor: '',
};

export class CandlestickSeries extends BaseSeries {
  private opts: CandlestickSeriesOptions;

  constructor(id: string, options: Partial<CandlestickSeriesOptions> = {}, priceScaleId = 'right') {
    super(id, 'candlestick', priceScaleId);
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
    const bodyWidth = Math.max(1, viewport.barSpacing * 0.6);
    const halfBody = bodyWidth / 2;

    const upColor = this.opts.upColor || theme.colors.candleUp;
    const downColor = this.opts.downColor || theme.colors.candleDown;
    const wickUp = this.opts.wickUpColor || theme.colors.wickUp;
    const wickDown = this.opts.wickDownColor || theme.colors.wickDown;

    for (let i = startIndex; i <= endIndex && i < data.length; i++) {
      const bar = data[i] as OHLCV;
      if (!bar || !('open' in bar)) continue;

      const x = viewport.barIndexToX(i, totalBars);
      const isUp = bar.close >= bar.open;
      const color = isUp ? upColor : downColor;
      const wColor = isUp ? wickUp : wickDown;

      const openY = viewport.priceToY(bar.open);
      const closeY = viewport.priceToY(bar.close);
      const highY = viewport.priceToY(bar.high);
      const lowY = viewport.priceToY(bar.low);

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = wColor;
      ctx.lineWidth = 1;
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(x - halfBody, bodyTop, bodyWidth, bodyHeight);
    }
  }
}
