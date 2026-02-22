import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Chart } from '../core/Chart.ts';
import type { ChartOptions, Theme } from '../types.ts';

export type BeakChartRef = {
  chart: Chart | null;
};

export type BeakChartProps = {
  options?: Partial<ChartOptions>;
  theme?: Theme;
  className?: string;
  style?: React.CSSProperties;
  onChartReady?: (chart: Chart) => void;
};

export const BeakChart = forwardRef<BeakChartRef, BeakChartProps>(function BeakChart(
  { options, theme, className, style, onChartReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useImperativeHandle(ref, () => ({
    get chart() {
      return chartRef.current;
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new Chart(containerRef.current, {
      ...options,
      autoSize: true,
      ...(theme ? { theme } : {}),
    });

    chartRef.current = chart;
    onChartReady?.(chart);

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // Only create chart once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme updates
  useEffect(() => {
    if (chartRef.current && theme) {
      chartRef.current.setTheme(theme);
    }
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
});
