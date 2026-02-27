import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, LineDataPoint, ParamSpec } from '../types';

const SOURCE_OPTIONS = ['close', 'open', 'high', 'low', 'median'] as const;

function getSourcePrice(p: OHLCVLike, source: string): number {
    if (source === 'median') return (p.high + p.low) / 2;
    if (source === 'open') return p.open;
    if (source === 'high') return p.high;
    if (source === 'low') return p.low;
    return p.close;
}

function computeEma(values: number[], period: number): Array<number | null> {
    if (values.length === 0) return [];
    const alpha = 2 / (period + 1);
    let ema: number | null = null;
    let seedSum = 0;
    return values.map((v, i) => {
        if (i < period - 1) { seedSum += v; return null; }
        if (i === period - 1) { seedSum += v; ema = seedSum / period; return ema; }
        ema = (v - ema!) * alpha + ema!;
        return ema;
    });
}

const ema: IndicatorDefinition = {
    id: 'ema',
    name: 'Exponential Moving Average (EMA)',
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
        const emaValues = computeEma(sourceValues, period);

        return prices.map((p, i) => {
            const shiftedIndex = i - offset;
            if (shiftedIndex < 0 || shiftedIndex >= emaValues.length) {
                return { time: p.timestamp, value: null };
            }
            return { time: p.timestamp, value: emaValues[shiftedIndex] };
        });
    },
};

export default ema;
