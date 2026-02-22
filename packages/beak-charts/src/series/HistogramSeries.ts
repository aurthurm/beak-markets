import { BaseSeries } from './BaseSeries.ts';
import type { Viewport, SubPaneViewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { HistogramDataPoint, HistogramSeriesOptions, OHLCV } from '../types.ts';
import type { Theme } from '../theme/types.ts';

const DEFAULTS: HistogramSeriesOptions = {
  upColor: '',
  downColor: '',
  opacity: 1,
};

export class HistogramSeries extends BaseSeries {
  private opts: HistogramSeriesOptions;

  constructor(id: string, options: Partial<HistogramSeriesOptions> = {}, priceScaleId = 'volume') {
    super(id, 'histogram', priceScaleId);
    this.opts = { ...DEFAULTS, ...options };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    subPane: SubPaneViewport | null,
    dataManager: DataManager,
    theme: Theme,
  ): void {
    const series = dataManager.getSeries(this.id);
    if (!series || !series.visible || series.data.length === 0) return;

    const totalBars = series.data.length;
    const range = viewport.getVisibleRange(totalBars);
    const barWidth = Math.max(1, viewport.barSpacing * 0.7);
    const halfBar = barWidth / 2;

    // Compute volume range for the visible window
    let maxVal = 0;
    for (let i = range.startIndex; i <= range.endIndex && i < totalBars; i++) {
      const d = series.data[i]!;
      const val = 'value' in d ? (d.value ?? 0) : ((d as OHLCV).volume ?? 0);
      if (val > maxVal) maxVal = val;
    }

    if (maxVal === 0) return;

    // Use subPane if provided (volume occupies bottom portion)
    const paneTop = subPane ? subPane.paneTop : viewport.chartHeight * 0.8;
    const paneHeight = subPane ? subPane.paneHeight : viewport.chartHeight * 0.2;

    const upColor = this.opts.upColor || theme.colors.volumeUp;
    const downColor = this.opts.downColor || theme.colors.volumeDown;

    for (let i = range.startIndex; i <= range.endIndex && i < totalBars; i++) {
      const d = series.data[i]!;
      const val = 'value' in d ? ((d as HistogramDataPoint).value ?? 0) : ((d as OHLCV).volume ?? 0);
      const x = viewport.barIndexToX(i, totalBars);
      const h = (val / maxVal) * paneHeight;
      const y = paneTop + paneHeight - h;

      // Determine color
      let color: string;
      if ('color' in d && (d as HistogramDataPoint).color) {
        color = (d as HistogramDataPoint).color!;
      } else if ('open' in d && 'close' in d) {
        color = (d as OHLCV).close >= (d as OHLCV).open ? upColor : downColor;
      } else {
        color = upColor;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x - halfBar, y, barWidth, h);
    }
  }
}
