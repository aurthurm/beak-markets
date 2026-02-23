import type { Plugin } from '../types.ts';
import type { FractalData } from './types.ts';

/**
 * Creates a plugin that draws Williams Fractal markers on the chart.
 *
 * @param getData  Callback that returns the current map of fractal data keyed
 *                 by indicator id. The callback is invoked on every draw frame
 *                 so the plugin always reflects the latest computed fractals.
 */
export function createFractalsPlugin(getData: () => Map<string, FractalData>): Plugin {
  return {
    name: 'fractals',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        const SIZE = 5;

        for (const fdata of getData().values()) {
          if (!fdata.visible) continue;

          ctx.save();
          ctx.fillStyle   = fdata.color;
          ctx.globalAlpha = 0.85;

          // Up fractals — downward-pointing triangle above the high
          for (const pt of fdata.up) {
            const x = viewport.barIndexToX(pt.barIndex, totalBars);
            const y = viewport.priceToY(pt.price) - SIZE - 4;
            ctx.beginPath();
            ctx.moveTo(x,                y + SIZE);   // bottom tip
            ctx.lineTo(x - SIZE * 0.65,  y);          // top-left
            ctx.lineTo(x + SIZE * 0.65,  y);          // top-right
            ctx.closePath();
            ctx.fill();
          }

          // Down fractals — upward-pointing triangle below the low
          for (const pt of fdata.down) {
            const x = viewport.barIndexToX(pt.barIndex, totalBars);
            const y = viewport.priceToY(pt.price) + SIZE + 4;
            ctx.beginPath();
            ctx.moveTo(x,                y - SIZE);   // top tip
            ctx.lineTo(x - SIZE * 0.65,  y);          // bottom-left
            ctx.lineTo(x + SIZE * 0.65,  y);          // bottom-right
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  };
}
