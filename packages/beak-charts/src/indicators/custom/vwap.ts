import type { IndicatorDefinition, IndicatorComputeContext, OHLCVLike, LineDataPoint } from '@beak/charts';

const SOURCE_OPTIONS = ['close', 'open', 'high', 'low', 'median'] as const;

function getSourcePrice(p: OHLCVLike, source: string): number {
    if (source === 'median') return (p.high + p.low) / 2;
    if (source === 'open') return p.open;
    if (source === 'high') return p.high;
    if (source === 'low') return p.low;
    return p.close;
}

const vwap: IndicatorDefinition = {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    placement: 'overlay',

    defaultParams: {
        source: 'close',
        color: '#fbbf24', // amber color
    },

    paramSchema: [
        { key: 'source', label: 'Source', type: 'string', options: [...SOURCE_OPTIONS], default: 'close' },
        { key: 'color', label: 'Color', type: 'color', default: '#fbbf24' },
    ],

    computeOverlay(
        prices: OHLCVLike[],
        params: Record<string, unknown>,
        _ctx: IndicatorComputeContext,
    ): LineDataPoint[] {
        const source = String(params?.source ?? 'close');

        // We do a simple cumulative VWAP from the start of the visible array.
        // In a real VWAP you might reset daily, but this suffices for a custom indicator example.
        let sumPV = 0;
        let sumV = 0;

        return prices.map((p) => {
            const price = getSourcePrice(p, source);
            const vol = p.volume || 0;

            sumPV += price * vol;
            sumV += vol;

            const vwapValue = sumV === 0 ? null : sumPV / sumV;

            return { time: p.timestamp, value: vwapValue };
        });
    },
};

export default vwap;
