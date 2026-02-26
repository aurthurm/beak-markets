import type { Plugin } from '../types.ts';
import type { OpenLinesData, OpenLineSegment } from './types.ts';

/**
 * Creates a plugin that draws session Open Lines (daily, weekly, monthly).
 *
 * Each line is a horizontal dashed segment that starts at the first bar of the
 * period and ends at the last bar of the same period.  A small label ("D", "W",
 * or "M") is placed at the visible left edge of each line for quick orientation.
 *
 * @param getData  Callback returning the current map of open-lines data keyed
 *                 by indicator id.  Called on every draw frame.
 */
export function createOpenLinesPlugin(
  getData: () => Map<string, OpenLinesData>,
): Plugin {
  return {
    name: 'openLines',
    hooks: {
      afterDraw: ({ ctx, viewport, dataManager }) => {
        const totalBars = dataManager.getTotalBars();
        if (totalBars === 0) return;

        const { startIndex, endIndex } = viewport.getVisibleRange(totalBars);

        for (const oldata of getData().values()) {
          if (!oldata.visible) continue;

          ctx.save();
          ctx.lineWidth = 1;

          const drawSet = (
            segments: OpenLineSegment[],
            color: string,
            label: string,
            show: boolean,
          ) => {
            if (!show || segments.length === 0) return;

            ctx.strokeStyle = color;
            ctx.fillStyle   = color;
            ctx.setLineDash([6, 4]);
            ctx.globalAlpha = 0.80;

            for (const seg of segments) {
              // Skip segments entirely outside the visible range
              if (seg.endBarIndex < startIndex || seg.startBarIndex > endIndex) continue;

              const x1Raw = viewport.barIndexToX(seg.startBarIndex, totalBars);
              // Extend the end half a bar-width past the last bar so the line
              // visually terminates at the right edge of the closing candle.
              const x2Raw = viewport.barIndexToX(seg.endBarIndex, totalBars)
                            + viewport.barSpacing * 0.5;
              const y     = viewport.priceToY(seg.price);

              const x1 = Math.max(0, x1Raw);
              const x2 = Math.min(viewport.chartWidth, x2Raw);
              if (x1 >= x2) continue;

              // Dashed horizontal line
              ctx.beginPath();
              ctx.moveTo(x1, y);
              ctx.lineTo(x2, y);
              ctx.stroke();

              // Label at the visible left edge of the line
              ctx.setLineDash([]);
              ctx.globalAlpha = 0.90;
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText(label, x1 + 3, y - 3);
              ctx.setLineDash([6, 4]);
              ctx.globalAlpha = 0.80;
            }
          };

          // Draw monthly first so daily sits on top
          drawSet(oldata.monthly, oldata.monthlyColor, 'M', oldata.showMonthly);
          drawSet(oldata.weekly,  oldata.weeklyColor,  'W', oldata.showWeekly);
          drawSet(oldata.daily,   oldata.dailyColor,   'D', oldata.showDaily);

          ctx.restore();
        }
      },
    },
  };
}
