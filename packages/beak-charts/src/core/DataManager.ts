import type { DataPoint, OHLCV, LineDataPoint, HistogramDataPoint, SeriesType } from '../types.ts';

export type StoredSeries = {
  id: string;
  type: SeriesType;
  data: DataPoint[];
  priceScaleId: string;
  visible: boolean;
};

export class DataManager {
  private _series = new Map<string, StoredSeries>();

  addSeries(id: string, type: SeriesType, priceScaleId = 'right'): void {
    this._series.set(id, { id, type, data: [], priceScaleId, visible: true });
  }

  removeSeries(id: string): void {
    this._series.delete(id);
  }

  setData(seriesId: string, data: DataPoint[]): void {
    const s = this._series.get(seriesId);
    if (s) s.data = data;
  }

  getSeries(id: string): StoredSeries | undefined {
    return this._series.get(id);
  }

  getAllSeries(): StoredSeries[] {
    return Array.from(this._series.values());
  }

  getSeriesByPriceScale(scaleId: string): StoredSeries[] {
    return this.getAllSeries().filter((s) => s.priceScaleId === scaleId && s.visible);
  }

  getTotalBars(): number {
    let max = 0;
    for (const s of this._series.values()) {
      if (s.data.length > max) max = s.data.length;
    }
    return max;
  }

  getTimeAtIndex(index: number): number | null {
    for (const s of this._series.values()) {
      if (s.data.length > index) {
        return s.data[index]!.time;
      }
    }
    return null;
  }

  getPriceRange(
    seriesIds: string[],
    startIndex: number,
    endIndex: number,
  ): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    for (const id of seriesIds) {
      const s = this._series.get(id);
      if (!s || !s.visible) continue;

      for (let i = Math.max(0, startIndex); i <= Math.min(s.data.length - 1, endIndex); i++) {
        const d = s.data[i]!;
        if (isOHLCV(d)) {
          if (d.low < min) min = d.low;
          if (d.high > max) max = d.high;
        } else {
          const val = (d as LineDataPoint | HistogramDataPoint).value;
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }

    if (min === Infinity) return { min: 0, max: 1 };
    return { min, max };
  }

  setSeriesVisibility(id: string, visible: boolean): void {
    const s = this._series.get(id);
    if (s) s.visible = visible;
  }
}

function isOHLCV(d: DataPoint): d is OHLCV {
  return 'open' in d && 'close' in d;
}
