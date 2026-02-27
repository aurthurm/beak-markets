import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, LineDataPoint, ParamSpec } from '../types';

function computeSma(values: number[], period: number): Array<number | null> {
    let rolling = 0;
    return values.map((v, i) => {
        rolling += v;
        if (i >= period) rolling -= values[i - period]!;
        if (i < period - 1) return null;
        return rolling / period;
    });
}

function computeBBValues(
    prices: OHLCVLike[],
    period: number,
    sourcePrices: number[],
    stdDev: number,
): { upper: LineDataPoint[]; middle: LineDataPoint[]; lower: LineDataPoint[] } {
    const sma = computeSma(sourcePrices, period);

    const upper: LineDataPoint[] = [];
    const middle: LineDataPoint[] = [];
    const lower: LineDataPoint[] = [];

    for (let i = 0; i < prices.length; i++) {
        const time = prices[i]!.timestamp;
        const mid = sma[i];
        if (mid == null) {
            upper.push({ time, value: null });
            middle.push({ time, value: null });
            lower.push({ time, value: null });
            continue;
        }
        let sumSq = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const diff = sourcePrices[j]! - mid;
            sumSq += diff * diff;
        }
        const sd = Math.sqrt(sumSq / period);
        upper.push({ time, value: mid + stdDev * sd });
        middle.push({ time, value: mid });
        lower.push({ time, value: mid - stdDev * sd });
    }

    return { upper, middle, lower };
}

const bb: IndicatorDefinition = {
    id: 'bb',
    name: 'Bollinger Bands (BB)',
    placement: 'overlay',

    defaultParams: {
        period: 20,
        source: 'close',
        bbStdDev: 2,
        color: '#38bdf8',
    },

    paramSchema: [
        { key: 'period', label: 'Period', type: 'number', min: 2, max: 300, default: 20 },
        { key: 'source', label: 'Source', type: 'string', options: ['close', 'open', 'high', 'low', 'median'], default: 'close' },
        { key: 'bbStdDev', label: 'Std Dev', type: 'number', min: 0.1, max: 5.0, default: 2 },
        { key: 'color', label: 'Color', type: 'color', default: '#38bdf8' },
    ],

    // Because BB returns 3 lines, we currently use computeOverlay to just return the middle line
    // and BeakChartWidget handles the upper/lower separately using `computeBBValues` from beak-charts
    // To fully support this in a generic way, IndicatorDefinition needs to support "multi-line overlay".
    // For now we just implement the hook for the middle line.
    computeOverlay(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): LineDataPoint[] {
        const period = Math.max(2, Math.min(300, Number(params?.period ?? 20)));
        const source = String(params?.source ?? 'close');
        const sourcePrices = prices.map(p => {
            if (source === 'median') return (p.high + p.low) / 2;
            if (source === 'open') return p.open;
            if (source === 'high') return p.high;
            if (source === 'low') return p.low;
            return p.close;
        });

        const stdDev = Number(params?.bbStdDev ?? 2);
        const { middle } = computeBBValues(prices, period, sourcePrices, stdDev);
        return middle;
    },
};

export default bb;
