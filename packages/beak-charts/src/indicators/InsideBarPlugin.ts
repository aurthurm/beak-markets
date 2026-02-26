import type { Plugin } from '../types.ts';
import type { InsideBarData } from './types.ts';

/**
 * Creates a plugin that draws Inside Bar pattern markers.
 *
 * A filled diamond (◆) is drawn below each inside bar's low.
 * The diamond shape distinguishes these markers from the triangles used by
 * Kangaroo Tail / Fractals and the circles used by Engulfing Candle.
 *
 * @param getData  Callback returning the current map of inside-bar data
 *                 keyed by indicator id. Called on every draw frame.
 */
export function createInsideBarPlugin(
  getData: () => Map<string, InsideBarData>,
): Plugin {
  return {
    name: 'insideBar',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        const SIZE = 5;   // half-width / half-height of the diamond (px)
        const GAP  = 5;   // gap between the bar's low and the top tip of the diamond (px)

        for (const idata of getData().values()) {
          if (!idata.visible) continue;

          ctx.save();
          ctx.fillStyle   = idata.color;
          ctx.globalAlpha = 0.88;

          for (const pt of idata.points) {
            const x      = viewport.barIndexToX(pt.barIndex, totalBars);
            const top    = viewport.priceToY(pt.price) + GAP;          // top tip
            const middle = top + SIZE;                                   // widest point
            const bottom = top + SIZE * 2;                              // bottom tip

            ctx.beginPath();
            ctx.moveTo(x,          top);     // top
            ctx.lineTo(x + SIZE,   middle);  // right
            ctx.lineTo(x,          bottom);  // bottom
            ctx.lineTo(x - SIZE,   middle);  // left
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  };
}
