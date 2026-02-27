import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, BottomIndicatorData, ParamSpec } from '../types';

function computeAtrValues(prices: OHLCVLike[], period: number): Array<number | null> {
    if (prices.length === 0) return [];
    const result: Array<number | null> = [null];
    let atr: number | null = null;
    let sumTr = 0;

    for (let i = 1; i < prices.length; i++) {
        const { high, low } = prices[i]!;
        const prevClose = prices[i - 1]!.close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

        if (i < period) { sumTr += tr; result.push(null); continue; }
        if (i === period) { sumTr += tr; atr = sumTr / period; }
        else { atr = (atr! * (period - 1) + tr) / period; }
        result.push(atr);
    }
    return result;
}

const atr: IndicatorDefinition = {
    id: 'atr',
    name: 'Average True Range (ATR)',
    placement: 'bottom',

    defaultParams: {
        period: 14,
        color: '#e879f9',
    },

    paramSchema: [
        { key: 'period', label: 'Period', type: 'number', min: 2, max: 300, default: 14 },
        { key: 'color', label: 'Color', type: 'color', default: '#e879f9' },
    ],

    computeBottom(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): BottomIndicatorData {
        const period = Math.max(2, Math.min(300, Number(params?.period ?? 14)));
        const color = String(params?.color ?? '#e879f9');

        const values = computeAtrValues(prices, period);

        return {
            lines: [{ label: `ATR ${period}`, color, values }],
        };
    },
};

export default atr;
