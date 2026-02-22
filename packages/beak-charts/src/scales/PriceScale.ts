import type { Viewport } from '../core/Viewport.ts';
import type { Theme } from '../theme/types.ts';

export class PriceScale {
  draw(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    theme: Theme,
    drawGrid: boolean,
  ): void {
    const chartW = viewport.chartWidth;
    const chartH = viewport.chartHeight;
    const scaleX = chartW;

    // Border line
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 1;
    ctx.moveTo(scaleX, 0);
    ctx.lineTo(scaleX, chartH);
    ctx.stroke();

    // Price labels
    const priceMin = viewport.priceMin;
    const priceMax = viewport.priceMax;
    const range = priceMax - priceMin;
    if (range <= 0) return;

    const targetLabels = Math.max(2, Math.floor(chartH / 60));
    const rawStep = range / targetLabels;
    const step = niceStep(rawStep);
    const decimals = getDecimals(step);

    ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
    ctx.fillStyle = theme.colors.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const firstLabel = Math.ceil(priceMin / step) * step;
    for (let price = firstLabel; price <= priceMax; price += step) {
      const y = viewport.priceToY(price);
      if (y < 0 || y > chartH) continue;

      // Grid line
      if (drawGrid) {
        ctx.beginPath();
        ctx.strokeStyle = theme.colors.grid;
        ctx.lineWidth = 1;
        ctx.moveTo(0, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();
      }

      // Label
      ctx.fillText(price.toFixed(decimals), scaleX + 6, y);
    }
  }
}

function niceStep(rawStep: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function getDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.max(0, -Math.floor(Math.log10(step)) + 1);
}
