import type { Plugin } from '../types.ts';
import type { ZigZagData } from './types.ts';

/**
 * Creates a plugin that draws ZigZag lines connecting swing highs and lows.
 *
 * Lines are drawn between consecutive confirmed (and trailing) pivots.
 * Small filled circles are drawn at each pivot for clarity.
 *
 * @param getData  Callback returning the current map of ZigZag data keyed
 *                 by indicator id. Called on every draw frame.
 */
export function createZigZagPlugin(getData: () => Map<string, ZigZagData>): Plugin {
  return {
    name: 'zigzag',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        for (const zdata of getData().values()) {
          if (!zdata.visible || zdata.points.length < 2) continue;

          ctx.save();
          ctx.strokeStyle = zdata.color;
          ctx.fillStyle   = zdata.color;
          ctx.lineWidth   = zdata.lineWidth;
          ctx.globalAlpha = 0.9;

          // Draw the connecting line through all pivots
          ctx.beginPath();
          const first = zdata.points[0]!;
          ctx.moveTo(
            viewport.barIndexToX(first.barIndex, totalBars),
            viewport.priceToY(first.price),
          );
          for (let i = 1; i < zdata.points.length; i++) {
            const pt = zdata.points[i]!;
            ctx.lineTo(
              viewport.barIndexToX(pt.barIndex, totalBars),
              viewport.priceToY(pt.price),
            );
          }
          ctx.stroke();

          // Draw pivot dots
          const DOT_R = Math.max(1.5, zdata.lineWidth * 0.9);
          for (const pt of zdata.points) {
            const x = viewport.barIndexToX(pt.barIndex, totalBars);
            const y = viewport.priceToY(pt.price);
            ctx.beginPath();
            ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  };
}
