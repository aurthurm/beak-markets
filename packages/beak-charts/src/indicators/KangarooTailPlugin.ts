import type { Plugin } from '../types.ts';
import type { KangarooTailData } from './types.ts';

/**
 * Creates a plugin that draws Kangaroo Tail (pinbar) pattern markers.
 *
 * Bullish hammer  → upward-pointing triangle (▲) below the bar's low
 * Bearish shooter → downward-pointing triangle (▼) above the bar's high
 *
 * @param getData  Callback returning the current map of kangaroo-tail data
 *                 keyed by indicator id. Called on every draw frame.
 */
export function createKangarooTailPlugin(
  getData: () => Map<string, KangarooTailData>,
): Plugin {
  return {
    name: 'kangarooTail',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        const SIZE = 6;   // triangle half-base width (px)
        const GAP  = 4;   // gap between price level and triangle (px)

        for (const kdata of getData().values()) {
          if (!kdata.visible) continue;

          ctx.save();
          ctx.fillStyle   = kdata.color;
          ctx.globalAlpha = 0.88;

          // Bullish: ▲ placed below the low, apex points up toward bar
          for (const pt of kdata.bullish) {
            const x    = viewport.barIndexToX(pt.barIndex, totalBars);
            const base = viewport.priceToY(pt.price) + GAP + SIZE;   // bottom edge
            const apex = base - SIZE;                                  // top tip
            ctx.beginPath();
            ctx.moveTo(x,            apex);    // tip (pointing up)
            ctx.lineTo(x - SIZE,     base);    // bottom-left
            ctx.lineTo(x + SIZE,     base);    // bottom-right
            ctx.closePath();
            ctx.fill();
          }

          // Bearish: ▼ placed above the high, apex points down toward bar
          for (const pt of kdata.bearish) {
            const x    = viewport.barIndexToX(pt.barIndex, totalBars);
            const base = viewport.priceToY(pt.price) - GAP - SIZE;   // top edge
            const apex = base + SIZE;                                  // bottom tip
            ctx.beginPath();
            ctx.moveTo(x,            apex);    // tip (pointing down)
            ctx.lineTo(x - SIZE,     base);    // top-left
            ctx.lineTo(x + SIZE,     base);    // top-right
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  };
}
