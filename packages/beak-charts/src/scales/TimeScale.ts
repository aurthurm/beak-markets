import type { Viewport } from '../core/Viewport.ts';
import type { DataManager } from '../core/DataManager.ts';
import type { Theme } from '../theme/types.ts';

export class TimeScale {
  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    dataManager: DataManager,
    theme: Theme,
    drawGrid: boolean,
  ): void {
    const totalBars = dataManager.getTotalBars();
    if (totalBars === 0) return;

    const range = viewport.getVisibleRange(totalBars);
    const chartW = viewport.chartWidth;
    const chartH = viewport.chartHeight;
    const axisY = chartH;

    // Border line
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 1;
    ctx.moveTo(0, axisY);
    ctx.lineTo(chartW, axisY);
    ctx.stroke();

    // Determine label spacing
    const labelMinSpacing = 80;
    const barsVisible = range.endIndex - range.startIndex + 1;
    const step = Math.max(1, Math.floor(barsVisible / (chartW / labelMinSpacing)));

    ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
    ctx.fillStyle = theme.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = range.startIndex; i <= range.endIndex; i += step) {
      const x = viewport.barIndexToX(i, totalBars);
      if (x < 0 || x > chartW) continue;

      // Grid line
      if (drawGrid) {
        ctx.beginPath();
        ctx.strokeStyle = theme.colors.grid;
        ctx.lineWidth = 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chartH);
        ctx.stroke();
      }

      // Label
      const time = dataManager.getTimeAtIndex(i);
      if (time !== null) {
        const label = formatTime(time);
        ctx.fillText(label, x, axisY + 6);
      }
    }
  }
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}
