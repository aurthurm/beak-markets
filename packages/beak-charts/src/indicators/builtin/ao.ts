import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, BottomIndicatorData, ParamSpec } from '../types';

function computeSma(values: number[], period: number): Array<number | null> {
    let rolling = 0;
    return values.map((v, i) => {
        rolling += v;
        if (i >= period) rolling -= values[i - period]!;
        if (i < period - 1) return null;
        return rolling / period;
    });
}

function computeAoValues(prices: OHLCVLike[]): Array<number | null> {
    const medians = prices.map((p) => (p.high + p.low) / 2);
    const sma5 = computeSma(medians, 5);
    const sma34 = computeSma(medians, 34);
    return medians.map((_, i) => {
        const fast = sma5[i];
        const slow = sma34[i];
        if (fast == null || slow == null) return null;
        return fast - slow;
    });
}

const ao: IndicatorDefinition = {
    id: 'ao',
    name: 'Awesome Oscillator (AO)',
    placement: 'bottom',

    defaultParams: {
        color: '#a78bfa',
    },

    paramSchema: [
        { key: 'color', label: 'Color', type: 'color', default: '#a78bfa' },
    ],

    computeBottom(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): BottomIndicatorData {
        const color = String(params?.color ?? '#a78bfa');
        const values = computeAoValues(prices);

        return {
            lines: [{ label: 'AO', color, values }],
            histogram: { values, upColor: '#22c55e88', downColor: '#ef444488' },
            referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
        };
    },
};

export default ao;
