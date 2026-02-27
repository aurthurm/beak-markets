import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, BottomIndicatorData, ParamSpec } from '../types';

export function computeRsiValues(prices: OHLCVLike[], period: number): Array<number | null> {
    if (prices.length === 0) return [];
    const result: Array<number | null> = [null];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i < prices.length; i++) {
        const diff = prices[i]!.close - prices[i - 1]!.close;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        if (i < period) { avgGain += gain; avgLoss += loss; result.push(null); continue; }
        if (i === period) {
            avgGain = (avgGain + gain) / period;
            avgLoss = (avgLoss + loss) / period;
        } else {
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
        }
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
    }
    return result;
}

const rsi: IndicatorDefinition = {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    placement: 'bottom',

    defaultParams: {
        period: 14,
        color: '#a855f7',
        overbought: 70,
        oversold: 30,
    },

    paramSchema: [
        { key: 'period', label: 'Period', type: 'number', min: 2, max: 100, default: 14 },
        { key: 'color', label: 'Color', type: 'color', default: '#a855f7' },
        { key: 'overbought', label: 'Overbought Level', type: 'number', min: 50, max: 100, default: 70 },
        { key: 'oversold', label: 'Oversold Level', type: 'number', min: 0, max: 50, default: 30 },
    ],

    computeBottom(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): BottomIndicatorData {
        const period = Number(params?.period ?? 14);
        const color = String(params?.color ?? '#a855f7');
        const overbought = Number(params?.overbought ?? 70);
        const oversold = Number(params?.oversold ?? 30);

        const values = computeRsiValues(prices, period);

        return {
            lines: [{ label: `RSI ${period}`, color, values }],
            referenceLines: [
                { value: overbought, color: '#ef4444aa', dashed: true },
                { value: oversold, color: '#22c55eaa', dashed: true },
                { value: 50, color: '#94a3b844', dashed: true },
            ],
            yRange: { min: 0, max: 100 },
        };
    },
};

export default rsi;
