import { useRef, useCallback } from 'react';
import type { Chart } from '../core/Chart.ts';
import type { BeakChartRef } from './BeakChart.tsx';

export function useBeakChart() {
  const ref = useRef<BeakChartRef>(null);

  const getChart = useCallback((): Chart | null => {
    return ref.current?.chart ?? null;
  }, []);

  return { ref, getChart };
}
