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
  private _cachedTotalBars: number | null = null;
  private _cachedRightSeriesIds: string[] | null = null;
  private _cachedTimeSeries: StoredSeries | null = null;

  private _invalidateCache(): void {
    this._cachedTotalBars = null;
    this._cachedRightSeriesIds = null;
    this._cachedTimeSeries = null;
  }

  addSeries(id: string, type: SeriesType, priceScaleId = 'right'): void {
    this._series.set(id, { id, type, data: [], priceScaleId, visible: true });
    this._invalidateCache();
  }

  removeSeries(id: string): void {
    this._series.delete(id);
    this._invalidateCache();
  }

  setData(seriesId: string, data: DataPoint[]): void {
    const s = this._series.get(seriesId);
    if (s) {
      s.data = data;
      this._cachedTotalBars = null;
      this._cachedTimeSeries = null;
    }
  }

  getSeries(id: string): StoredSeries | undefined {
    return this._series.get(id);
  }

  getAllSeries(): StoredSeries[] {
    return Array.from(this._series.values());
  }

  /** Returns series IDs for a price scale (allocation-friendly; returns a copy). */
  getSeriesIdsByPriceScale(scaleId: string): string[] {
    if (scaleId === 'right') {
      if (this._cachedRightSeriesIds === null) {
        const list: string[] = [];
        for (const s of this._series.values()) {
          if (s.priceScaleId === 'right' && s.visible) list.push(s.id);
        }
        this._cachedRightSeriesIds = list;
      }
      return this._cachedRightSeriesIds.slice();
    }
    const out: string[] = [];
    for (const s of this._series.values()) {
      if (s.priceScaleId === scaleId && s.visible) out.push(s.id);
    }
    return out;
  }

  getSeriesByPriceScale(scaleId: string): StoredSeries[] {
    if (scaleId === 'right') {
      if (this._cachedRightSeriesIds !== null) {
        const out: StoredSeries[] = [];
        for (const id of this._cachedRightSeriesIds) {
          const s = this._series.get(id);
          if (s?.visible) out.push(s);
        }
        return out;
      }
      const list: string[] = [];
      for (const s of this._series.values()) {
        if (s.priceScaleId === 'right' && s.visible) list.push(s.id);
      }
      this._cachedRightSeriesIds = list;
      return list.map((id) => this._series.get(id)!).filter(Boolean);
    }
    return this.getAllSeries().filter((s) => s.priceScaleId === scaleId && s.visible);
  }

  getTotalBars(): number {
    if (this._cachedTotalBars !== null) return this._cachedTotalBars;
    let max = 0;
    for (const s of this._series.values()) {
      if (s.data.length > max) max = s.data.length;
    }
    this._cachedTotalBars = max;
    return max;
  }

  /** Uses a single primary series for time to avoid O(series) per index in TimeScale. */
  getTimeAtIndex(index: number): number | null {
    const primary = this._getPrimaryTimeSeries();
    if (primary && primary.data.length > index) return primary.data[index]!.time;
    return null;
  }

  private _getPrimaryTimeSeries(): StoredSeries | null {
    if (this._cachedTimeSeries !== null) return this._cachedTimeSeries;
    let best: StoredSeries | null = null;
    for (const s of this._series.values()) {
      if (s.data.length > 0 && (!best || s.data.length > best.data.length))
        best = s;
    }
    this._cachedTimeSeries = best;
    return best;
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
          if (val !== null && val < min) min = val;
          if (val !== null && val > max) max = val;
        }
      }
    }

    if (min === Infinity) return { min: 0, max: 1 };
    return { min, max };
  }

  setSeriesVisibility(id: string, visible: boolean): void {
    const s = this._series.get(id);
    if (s) {
      s.visible = visible;
      this._cachedRightSeriesIds = null;
    }
  }
}

function isOHLCV(d: DataPoint): d is OHLCV {
  return 'open' in d && 'close' in d;
}
