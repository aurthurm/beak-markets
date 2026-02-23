import { useEffect, useRef, useState, useCallback } from 'react';
import type { Theme, BottomIndicatorData } from '@beak/charts';

type ViewportSync = {
  start: number;
  end: number;
  totalBars: number;
  chartWidth: number;
  barSpacing: number;
};

type IndicatorPanelProps = {
  indicatorId: string;
  label: string;
  visible: boolean;
  data: BottomIndicatorData | undefined;
  viewportSync: ViewportSync | null;
  theme: Theme;
  hoverIndex: number | null;
  hoverX: number | null;
  onRemove: () => void;
  onSettings: () => void;
  onToggleVisibility: () => void;
  onPointerIndex: (index: number | null) => void;
  onPointerX: (x: number | null) => void;
};

const DEFAULT_HEIGHT = 120;
const MIN_HEIGHT = 60;
const MAX_HEIGHT = 280;
const PRICE_SCALE_WIDTH = 58;

export default function IndicatorPanel({
  indicatorId,
  label,
  visible,
  data,
  viewportSync,
  theme,
  hoverIndex,
  hoverX,
  onRemove,
  onSettings,
  onToggleVisibility,
  onPointerIndex,
  onPointerX,
}: IndicatorPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ y: 0, h: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !viewportSync || !visible) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w === 0 || h === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const chartW = viewportSync.chartWidth;
    const chartH = h;
    const { start, end, barSpacing } = viewportSync;

    const { yMin, yMax } = getYRange(data, start, end);
    const yRange = yMax - yMin || 1;
    const margin = 0.08;
    const effectiveMin = yMin - yRange * margin;
    const effectiveMax = yMax + yRange * margin;
    const effectiveRange = effectiveMax - effectiveMin;

    const priceToY = (v: number) =>
      ((effectiveMax - v) / effectiveRange) * chartH;

    const barIndexToX = (idx: number) =>
      (idx - start + 0.5) * barSpacing;

    // Background
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, w, h);

    // Top border
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(w, 0.5);
    ctx.stroke();

    // Horizontal grid + reference lines
    drawHorizontalGrid(ctx, chartW, chartH, effectiveMin, effectiveMax, priceToY, theme);
    if (data.referenceLines) {
      for (const ref of data.referenceLines) {
        const ry = priceToY(ref.value);
        if (ry < 0 || ry > chartH) continue;
        ctx.save();
        ctx.strokeStyle = ref.color;
        ctx.lineWidth = 1;
        if (ref.dashed) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(chartW, ry);
        ctx.stroke();
        ctx.restore();

        // Label on price scale
        ctx.fillStyle = ref.color;
        ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(ref.value.toFixed(1), chartW + 4, ry);
      }
    }

    // Clip to chart area for data rendering
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartW, chartH);
    ctx.clip();

    // Histogram
    if (data.histogram) {
      const halfBar = Math.max(1, barSpacing * 0.35);
      for (let i = start; i <= end; i++) {
        const val = data.histogram.values[i];
        if (val == null) continue;
        const x = barIndexToX(i);
        const zeroY = priceToY(0);
        const valY = priceToY(val);
        ctx.fillStyle = val >= 0 ? data.histogram.upColor : data.histogram.downColor;
        const top = Math.min(zeroY, valY);
        const barH = Math.abs(zeroY - valY);
        ctx.fillRect(x - halfBar, top, halfBar * 2, Math.max(1, barH));
      }
    }

    // Lines
    for (const line of data.lines) {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = start; i <= end; i++) {
        const val = line.values[i];
        if (val == null) {
          started = false;
          continue;
        }
        const x = barIndexToX(i);
        const y = priceToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Crosshair — use raw pixel X (passed from parent) for pixel-perfect alignment
    // with the main chart crosshair line
    if (hoverX != null && hoverX >= 0 && hoverX <= chartW) {
      ctx.strokeStyle = theme.colors.crosshair ?? theme.colors.text;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Price scale background
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(chartW, 0, PRICE_SCALE_WIDTH, h);

    // Price scale border
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartW + 0.5, 0);
    ctx.lineTo(chartW + 0.5, h);
    ctx.stroke();

    // Price scale labels
    drawPriceScaleLabels(ctx, chartW, chartH, effectiveMin, effectiveMax, priceToY, theme);
  }, [data, viewportSync, theme, hoverIndex, hoverX, visible]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width) * dpr;
        canvas.height = Math.floor(height) * dpr;
        canvas.style.width = `${Math.floor(width)}px`;
        canvas.style.height = `${Math.floor(height)}px`;
      }
      draw();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    resizeStartRef.current = { y: e.clientY, h: panelHeight };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelHeight]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    const dy = e.clientY - resizeStartRef.current.y;
    const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStartRef.current.h + dy));
    setPanelHeight(newH);
  }, []);

  const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
    resizingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportSync) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { start, end, chartWidth, barSpacing } = viewportSync;
    if (x > chartWidth || x < 0) {
      onPointerIndex(null);
      onPointerX(null);
      return;
    }
    // Use Math.round consistent with Viewport.xToBarIndex
    const idx = Math.max(start, Math.min(end, Math.round(start + (x - barSpacing / 2) / barSpacing)));
    // Snap to bar centre so the crosshair aligns with the main chart crosshair
    const barCenterX = (idx - start + 0.5) * barSpacing;
    onPointerIndex(idx);
    onPointerX(barCenterX);
  }, [viewportSync, onPointerIndex, onPointerX]);

  const currentValues = data?.lines.map((line) => {
    const idx = hoverIndex ?? (data.lines[0]?.values.length ?? 1) - 1;
    return { label: line.label, color: line.color, value: line.values[idx] ?? null };
  }) ?? [];

  if (collapsed) {
    return (
      <div className="nodrag shrink-0 flex items-center gap-1.5 px-2 h-6 border-t border-slate-700/60" style={{ background: theme.colors.background }}>
        <button
          onClick={() => setCollapsed(false)}
          className="text-slate-400 hover:text-slate-200 text-[10px]"
          title="Expand"
        >
          <ChevronDown />
        </button>
        <span className="text-[10px] text-slate-400">{label}</span>
        {currentValues.map((v) => (
          <span key={v.label} className="text-[10px] font-mono" style={{ color: v.color }}>
            {v.value != null ? v.value.toFixed(2) : '--'}
          </span>
        ))}
        <div className="flex-1" />
        <button onClick={onRemove} className="text-slate-500 hover:text-slate-300 text-[10px]" title="Remove">✕</button>
      </div>
    );
  }

  return (
    <div className="nodrag shrink-0 relative flex flex-col" style={{ height: panelHeight }}>
      {/* Resize handle */}
      <div
        className="absolute -top-[3px] left-0 right-0 h-[6px] cursor-ns-resize z-10 hover:bg-cyan-500/30 active:bg-cyan-500/40"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
      />

      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2 h-5 shrink-0 border-t border-slate-700/60 select-none"
        style={{ background: theme.colors.background }}
      >
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-400 hover:text-slate-200 text-[10px]"
          title="Collapse"
        >
          <ChevronUp />
        </button>
        <span className="text-[10px] text-slate-400 font-medium">{label}</span>
        {currentValues.map((v) => (
          <span key={v.label} className="text-[10px] font-mono" style={{ color: v.color }}>
            {v.label}: {v.value != null ? v.value.toFixed(2) : '--'}
          </span>
        ))}
        <div className="flex-1" />
        <button
          onClick={onToggleVisibility}
          className="text-slate-500 hover:text-slate-300"
          title={visible ? 'Hide' : 'Show'}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            {visible ? (
              <>
                <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
                <circle cx="8" cy="8" r="2" />
              </>
            ) : (
              <>
                <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
                <path d="M2 14L14 2" />
              </>
            )}
          </svg>
        </button>
        <button onClick={onSettings} className="text-slate-500 hover:text-slate-300" title="Settings">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2" />
            <path d="M6.7 1.2l-.3 1.6a5.5 5.5 0 00-1.5.9L3.4 3 2 5.4l1.3 1a5.5 5.5 0 000 1.8L2 9.6 3.4 12l1.5-.7a5.5 5.5 0 001.5.9l.3 1.6h2.6l.3-1.6a5.5 5.5 0 001.5-.9l1.5.7L14 9.6l-1.3-1a5.5 5.5 0 000-1.8l1.3-1L12.6 3l-1.5.7a5.5 5.5 0 00-1.5-.9l-.3-1.6z" />
          </svg>
        </button>
        <button onClick={onRemove} className="text-slate-500 hover:text-slate-300" title="Remove">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => { onPointerIndex(null); onPointerX(null); }}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 block"
          style={{ opacity: visible ? 1 : 0.3 }}
        />
      </div>
    </div>
  );
}

function drawHorizontalGrid(
  ctx: CanvasRenderingContext2D,
  chartW: number,
  chartH: number,
  yMin: number,
  yMax: number,
  priceToY: (v: number) => number,
  theme: Theme,
) {
  const range = yMax - yMin;
  if (range === 0) return;

  const targetLines = Math.max(2, Math.floor(chartH / 30));
  const rawStep = range / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 5, 10];
  let step = candidates[0] * magnitude;
  for (const c of candidates) {
    if (c * magnitude >= rawStep) {
      step = c * magnitude;
      break;
    }
  }

  const startVal = Math.ceil(yMin / step) * step;
  ctx.strokeStyle = theme.colors.grid;
  ctx.lineWidth = 0.5;

  for (let val = startVal; val <= yMax; val += step) {
    const y = priceToY(val);
    if (y < 1 || y > chartH - 1) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartW, y);
    ctx.stroke();
  }
}

function drawPriceScaleLabels(
  ctx: CanvasRenderingContext2D,
  chartW: number,
  chartH: number,
  yMin: number,
  yMax: number,
  priceToY: (v: number) => number,
  theme: Theme,
) {
  const range = yMax - yMin;
  if (range === 0) return;

  const targetLines = Math.max(2, Math.floor(chartH / 30));
  const rawStep = range / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 5, 10];
  let step = candidates[0] * magnitude;
  for (const c of candidates) {
    if (c * magnitude >= rawStep) {
      step = c * magnitude;
      break;
    }
  }

  const startVal = Math.ceil(yMin / step) * step;
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 4;

  ctx.fillStyle = theme.colors.text;
  ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (let val = startVal; val <= yMax; val += step) {
    const y = priceToY(val);
    if (y < 8 || y > chartH - 8) continue;
    ctx.fillText(val.toFixed(decimals), chartW + 4, y);
  }
}

function getYRange(
  data: BottomIndicatorData,
  start: number,
  end: number,
): { yMin: number; yMax: number } {
  if (data.yRange) return { yMin: data.yRange.min, yMax: data.yRange.max };

  let yMin = Infinity;
  let yMax = -Infinity;

  for (const line of data.lines) {
    for (let i = start; i <= end && i < line.values.length; i++) {
      const v = line.values[i];
      if (v == null) continue;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }

  if (data.histogram) {
    for (let i = start; i <= end && i < data.histogram.values.length; i++) {
      const v = data.histogram.values[i];
      if (v == null) continue;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }

  if (!isFinite(yMin)) { yMin = -1; yMax = 1; }
  return { yMin, yMax };
}

function ChevronUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7.5L6 4.5L3 7.5" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}
