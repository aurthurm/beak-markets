import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, BottomIndicatorData, ParamSpec } from '../types';

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

function computeMacdValues(
    prices: OHLCVLike[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
): { macdLine: Array<number | null>; signalLine: Array<number | null>; histogram: Array<number | null> } {
    const closes = prices.map((p) => p.close);
    const fastEma = computeEma(closes, fastPeriod);
    const slowEma = computeEma(closes, slowPeriod);

    const macdLine: Array<number | null> = closes.map((_, i) => {
        const f = fastEma[i];
        const s = slowEma[i];
        if (f == null || s == null) return null;
        return f - s;
    });

    const macdNonNull = macdLine.filter((v): v is number => v != null);
    const signalRaw = computeEma(macdNonNull, signalPeriod);
    const signalLine: Array<number | null> = [];
    let si = 0;
    for (const v of macdLine) {
        if (v == null) {
            signalLine.push(null);
        } else {
            signalLine.push(signalRaw[si] ?? null);
            si++;
        }
    }

    const histogram: Array<number | null> = macdLine.map((m, i) => {
        const s = signalLine[i];
        if (m == null || s == null) return null;
        return m - s;
    });

    return { macdLine, signalLine, histogram };
}

const macd: IndicatorDefinition = {
    id: 'macd',
    name: 'MACD',
    placement: 'bottom',

    defaultParams: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        color: '#06b6d4',
    },

    paramSchema: [
        { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', min: 2, max: 200, default: 12 },
        { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', min: 2, max: 200, default: 26 },
        { key: 'signalPeriod', label: 'Signal Smoothing', type: 'number', min: 2, max: 100, default: 9 },
        { key: 'color', label: 'Color', type: 'color', default: '#06b6d4' },
    ],

    computeBottom(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): BottomIndicatorData {
        const fast = Number(params?.fastPeriod ?? 12);
        const slow = Number(params?.slowPeriod ?? 26);
        const sig = Number(params?.signalPeriod ?? 9);
        const color = String(params?.color ?? '#06b6d4');

        const { macdLine, signalLine, histogram } = computeMacdValues(prices, fast, slow, sig);

        return {
            lines: [
                { label: `MACD ${fast}`, color, values: macdLine },
                { label: `Signal ${sig}`, color: '#f59e0b', values: signalLine },
            ],
            histogram: { values: histogram, upColor: '#22c55e88', downColor: '#ef444488' },
            referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
        };
    },
};

export default macd;
