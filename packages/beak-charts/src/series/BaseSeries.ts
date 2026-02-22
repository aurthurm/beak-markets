import type { Viewport, SubPaneViewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { DataPoint, SeriesType } from '../types.ts';
import type { Theme } from '../theme/types.ts';

export abstract class BaseSeries {
  readonly id: string;
  readonly type: SeriesType;
  priceScaleId: string;

  constructor(id: string, type: SeriesType, priceScaleId = 'right') {
    this.id = id;
    this.type = type;
    this.priceScaleId = priceScaleId;
  }

  abstract draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    subPane: SubPaneViewport | null,
    dataManager: DataManager,
    theme: Theme,
  ): void;

  protected getVisibleData(viewport: Viewport, dataManager: DataManager): { data: DataPoint[]; startIndex: number; endIndex: number } {
    const series = dataManager.getSeries(this.id);
    if (!series || !series.visible) return { data: [], startIndex: 0, endIndex: 0 };

    const totalBars = series.data.length;
    const range = viewport.getVisibleRange(totalBars);
    return {
      data: series.data,
      startIndex: range.startIndex,
      endIndex: range.endIndex,
    };
  }
}
