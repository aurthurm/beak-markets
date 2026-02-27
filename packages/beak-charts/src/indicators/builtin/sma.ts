import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, LineDataPoint, ParamSpec } from '../types';

const SOURCE_OPTIONS = ['close', 'open', 'high', 'low', 'median'] as const;

function getSourcePrice(p: OHLCVLike, source: string): number {
    if (source === 'median') return (p.high + p.low) / 2;
    if (source === 'open') return p.open;
    if (source === 'high') return p.high;
    if (source === 'low') return p.low;
    return p.close;
}

function computeSma(values: number[], period: number): Array<number | null> {
    let rolling = 0;
    return values.map((v, i) => {
        rolling += v;
        if (i >= period) rolling -= values[i - period]!;
        if (i < period - 1) return null;
        return rolling / period;
    });
}

const sma: IndicatorDefinition = {
    id: 'sma',
    name: 'Simple Moving Average (SMA)',
    placement: 'overlay',

    defaultParams: {
        period: 20,
        source: 'close',
        offset: 0,
    },

    paramSchema: [
        { key: 'period', label: 'Period', type: 'number', min: 2, max: 300, default: 20 },
        { key: 'source', label: 'Source', type: 'string', options: [...SOURCE_OPTIONS], default: 'close' },
        { key: 'offset', label: 'Offset', type: 'number', min: -100, max: 100, default: 0 },
    ],

    computeOverlay(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): LineDataPoint[] {
        const period = Math.max(2, Math.min(300, Number(params?.period ?? 20)));
        const source = String(params?.source ?? 'close');
        const offset = Number(params?.offset ?? 0);

        const sourceValues = prices.map((p) => getSourcePrice(p, source));
        const smaValues = computeSma(sourceValues, period);

        return prices.map((p, i) => {
            const shiftedIndex = i - offset;
            if (shiftedIndex < 0 || shiftedIndex >= smaValues.length) {
                return { time: p.timestamp, value: null };
            }
            return { time: p.timestamp, value: smaValues[shiftedIndex] };
        });
    },
};

export default sma;
