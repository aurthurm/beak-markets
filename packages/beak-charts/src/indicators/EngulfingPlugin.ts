import type { Plugin } from '../types.ts';
import type { EngulfingData } from './types.ts';

/**
 * Creates a plugin that draws Engulfing Candle pattern markers.
 *
 * Bullish engulfing  → filled circle (●) below the bar's low
 * Bearish engulfing  → filled circle (●) above the bar's high
 *
 * Circles distinguish engulfing markers from the triangles used by
 * Kangaroo Tail and Williams Fractals.
 *
 * @param getData  Callback returning the current map of engulfing data
 *                 keyed by indicator id. Called on every draw frame.
 */
export function createEngulfingPlugin(
  getData: () => Map<string, EngulfingData>,
): Plugin {
  return {
    name: 'engulfing',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        const RADIUS = 5;   // circle radius (px)
        const GAP    = 5;   // gap between price level and circle centre (px)

        for (const edata of getData().values()) {
          if (!edata.visible) continue;

          ctx.save();
          ctx.fillStyle   = edata.color;
          ctx.globalAlpha = 0.88;

          // Bullish: ● below the low
          for (const pt of edata.bullish) {
            const x = viewport.barIndexToX(pt.barIndex, totalBars);
            const y = viewport.priceToY(pt.price) + GAP + RADIUS;
            ctx.beginPath();
            ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
            ctx.fill();
          }

          // Bearish: ● above the high
          for (const pt of edata.bearish) {
            const x = viewport.barIndexToX(pt.barIndex, totalBars);
            const y = viewport.priceToY(pt.price) - GAP - RADIUS;
            ctx.beginPath();
            ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  };
}
