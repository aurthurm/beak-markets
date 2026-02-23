import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Chart, darkTheme, lightTheme } from '@beak/charts';
import type { Theme } from '@beak/charts';
import type {
  SeriesHandle,
  OHLCV,
  HistogramDataPoint,
  LineDataPoint,
  InteractionMode,
  FibLevel,
  IndicatorType,
  IndicatorConfig,
  IndicatorPlacement,
  IndicatorSource,
  IndicatorStyle,
  BottomIndicatorData,
  FractalData,
  PriceBar,
} from '@beak/charts';
import {
  DEFAULT_FIB_LEVELS,
  computeIndicatorData,
  computeBBValues,
  computeBottomPanelData,
  computeFractals,
  indicatorLabel,
  createFractalsPlugin,
} from '@beak/charts';
import { marketService } from '../../services/marketService';
import { useSimulationStore } from '../../store/useSimulationStore';
import { DrawingToolbar, type NavigationTool } from './DrawingToolbar';
import { FibLevelEditor } from './FibLevelEditor';
import IndicatorPanel, { type IndicatorPanelHandle } from './IndicatorPanel';

// ── Widget-local types ────────────────────────────────────────────────────────

type Props = { ticker: string };
type ChartType = 'candlestick' | 'bar' | 'line';
type Timeframe = '15m' | '1h' | '4h' | 'D' | 'W' | '2W' | '1M';
type IndicatorsTab = 'indicators' | 'strategies' | 'patterns';
const TIME_SCALE_HEIGHT = 24;

const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', 'D', 'W'];
const WEEKLY_TIMEFRAMES: Timeframe[] = ['W', '2W', '1M'];

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Candlestick' },
  { value: 'bar',         label: 'Bar' },
  { value: 'line',        label: 'Line' },
];

const INDICATOR_CATALOG: {
  key: string;
  label: string;
  type?: IndicatorType;
  color?: string;
  placement?: IndicatorPlacement;
  enabled: boolean;
}[] = [
  { key: 'volume',   label: 'Volume',                         type: 'volume',   color: '#10b981', placement: 'overlay', enabled: true  },
  { key: 'sma',      label: 'Simple Moving Average (SMA)',    type: 'sma',      color: '#22d3ee', placement: 'overlay', enabled: true  },
  { key: 'ema',      label: 'Exponential Moving Average (EMA)', type: 'ema',    color: '#f59e0b', placement: 'overlay', enabled: true  },
  { key: 'ao',       label: 'Awesome Oscillator',             type: 'ao',       color: '#a78bfa', placement: 'bottom',  enabled: true  },
  { key: 'rsi',      label: 'Relative Strength Index (RSI)',  type: 'rsi',      color: '#a855f7', placement: 'bottom',  enabled: true  },
  { key: 'macd',     label: 'MACD',                           type: 'macd',     color: '#06b6d4', placement: 'bottom',  enabled: true  },
  { key: 'atr',      label: 'Average True Range (ATR)',       type: 'atr',      color: '#e879f9', placement: 'bottom',  enabled: true  },
  { key: 'bb',       label: 'Bollinger Bands (BB)',           type: 'bb',       color: '#38bdf8', placement: 'overlay', enabled: true  },
  { key: 'fractals', label: 'Williams Fractals',              type: 'fractals', color: '#f59e0b', placement: 'overlay', enabled: true  },
];

const STRATEGY_CATALOG = ['Mean Reversion', 'Breakout', 'Trend Follow'];
const PATTERN_CATALOG  = ['Double Top', 'Head & Shoulders', 'Triangle'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BeakChartWidget({ ticker }: Props) {
  const currentIndex = useSimulationStore((s) => s.currentIndex);

  const chartAreaRef      = useRef<HTMLDivElement>(null);
  const chartPaneHostRef  = useRef<HTMLDivElement>(null);
  const containerRef      = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<Chart | null>(null);
  const candleSeriesRef   = useRef<SeriesHandle | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, SeriesHandle>>(new Map());
  const bbSeriesRefs        = useRef<Map<string, { upper: SeriesHandle; lower: SeriesHandle }>>(new Map());
  const fractalDataRef      = useRef<Map<string, FractalData>>(new Map());
  const panelHandlesRef     = useRef<Map<string, IndicatorPanelHandle>>(new Map());

  const timeframeDropdownRef  = useRef<HTMLDivElement>(null);
  const chartTypeDropdownRef  = useRef<HTMLDivElement>(null);

  const [timeframe,     setTimeframe]     = useState<Timeframe>('1h');
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [weeklyOpen,    setWeeklyOpen]    = useState(false);

  const [chartType,     setChartType]     = useState<ChartType>('candlestick');
  const [chartTypeOpen, setChartTypeOpen] = useState(false);

  const [indicators, setIndicators] = useState<IndicatorConfig[]>([
    {
      id: 'volume_default', type: 'volume', placement: 'overlay',
      period: 1, color: '#10b981', visible: true,
      source: 'close', offset: 0, lineWidth: 1, style: 'solid',
    },
  ]);
  const [indicatorsModalOpen,    setIndicatorsModalOpen]    = useState(false);
  const [indicatorsTab,          setIndicatorsTab]          = useState<IndicatorsTab>('indicators');
  const [favoriteIndicatorKeys,  setFavoriteIndicatorKeys]  = useState<string[]>(['sma']);

  const [overlayOpen,           setOverlayOpen]           = useState(false);
  const [settingsIndicatorId,   setSettingsIndicatorId]   = useState<string | null>(null);
  const [hoverIndex,            setHoverIndex]            = useState<number | null>(null);

  const [isDark,           setIsDark]           = useState(true);
  const [interactionMode,  setInteractionMode]  = useState<InteractionMode>('select');
  const [navigationTool,   setNavigationTool]   = useState<NavigationTool>('select');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [fibEditorOpen,    setFibEditorOpen]    = useState(false);
  const [fibLevels,        setFibLevels]        = useState<FibLevel[]>(() => DEFAULT_FIB_LEVELS.map(l => ({ ...l })));
  const [viewportSync, setViewportSync] = useState<{
    start: number; end: number; totalBars: number; chartWidth: number; barSpacing: number;
  } | null>(null);

  const dataset       = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const visiblePrices = useMemo(() => dataset.prices.slice(0, currentIndex + 1), [dataset, currentIndex]);

  /** Prices normalised to PriceBar (time instead of timestamp) for beak-charts compute functions. */
  const priceData = useMemo((): PriceBar[] =>
    visiblePrices.map(p => ({
      time:   p.timestamp,
      open:   p.open,
      high:   p.high,
      low:    p.low,
      close:  p.close,
      volume: p.volume,
    })),
  [visiblePrices]);

  const lastBar  = visiblePrices[visiblePrices.length - 1];
  const prevBar  = visiblePrices.length > 1 ? visiblePrices[visiblePrices.length - 2] : lastBar;
  const change   = lastBar ? lastBar.close - prevBar!.close : 0;
  const { pipSize, decimals } = marketService.getTickerDisplayInfo(ticker);
  const changePips = Math.round(change / pipSize);
  const changePct  = prevBar ? (change / prevBar.close) * 100 : 0;

  const chartLabel = useMemo(
    () => CHART_TYPE_OPTIONS.find((o) => o.value === chartType)?.label ?? 'Candlestick',
    [chartType],
  );

  const indicatorDataMap = useMemo(() => {
    const m = new Map<string, LineDataPoint[]>();
    for (const indicator of indicators) {
      m.set(indicator.id, computeIndicatorData(priceData, indicator));
    }
    return m;
  }, [priceData, indicators]);

  const bbBandDataMap = useMemo(() => {
    const m = new Map<string, { upper: LineDataPoint[]; lower: LineDataPoint[] }>();
    for (const indicator of indicators) {
      if (indicator.type !== 'bb') continue;
      const { upper, lower } = computeBBValues(priceData, indicator);
      m.set(indicator.id, { upper, lower });
    }
    return m;
  }, [priceData, indicators]);

  const bottomPanelDataMap = useMemo(() => {
    const m = new Map<string, BottomIndicatorData>();
    for (const indicator of indicators) {
      if (indicator.placement !== 'bottom') continue;
      m.set(indicator.id, computeBottomPanelData(priceData, indicator));
    }
    return m;
  }, [priceData, indicators]);

  const bottomIndicators = useMemo(
    () => indicators.filter((i) => i.placement === 'bottom'),
    [indicators],
  );

  const pointIndex = Math.min(
    Math.max(hoverIndex ?? visiblePrices.length - 1, 0),
    Math.max(visiblePrices.length - 1, 0),
  );

  // ── Chart init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = new Chart(container, {
      autoSize: true,
      theme: isDark ? darkTheme : lightTheme,
      timeScale: { height: 0 },
    });

    // Broadcast directly to panel handles — no React state round-trip, zero latency
    chart.onCrosshairMove((x) => {
      for (const handle of panelHandlesRef.current.values()) {
        handle.notifyCrosshairX(x);
      }
    });
    chart.onDrawingChange((event) => {
      if (event.type === 'selected') {
        setSelectedDrawingId(event.drawingId);
        if (event.drawingId) {
          const tool = chart.getDrawingManager().getDrawing(event.drawingId);
          if (tool?.config.type === 'fibonacci') {
            setFibLevels((tool.config.fibLevels ?? DEFAULT_FIB_LEVELS).map(l => ({ ...l })));
            setFibEditorOpen(true);
          } else {
            setFibEditorOpen(false);
          }
        } else {
          setFibEditorOpen(false);
        }
      }
      if (event.type === 'deleted') {
        setSelectedDrawingId(null);
        setFibEditorOpen(false);
      }
    });

    chart.setInteractionMode('select');
    chart.addPlugin(createFractalsPlugin(() => fractalDataRef.current));
    chartRef.current = chart;

    return () => {
      chart.onCrosshairMove(null);
      chart.onDrawingChange(null);
      chart.destroy();
      chartRef.current      = null;
      candleSeriesRef.current = null;
      indicatorSeriesRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Series creation (re-runs when chart type or indicators change) ───────────

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    candleSeriesRef.current?.remove();
    for (const h of indicatorSeriesRefs.current.values()) h.remove();
    indicatorSeriesRefs.current.clear();
    for (const bb of bbSeriesRefs.current.values()) { bb.upper.remove(); bb.lower.remove(); }
    bbSeriesRefs.current.clear();

    const mainSeries = chartType === 'candlestick'
      ? chart.addSeries('candlestick')
      : chartType === 'bar'
        ? chart.addSeries('bar')
        : chart.addSeries('line');

    candleSeriesRef.current = mainSeries;
    updateData(visiblePrices, mainSeries, chartType);

    for (const indicator of indicators) {
      if (!indicator.visible) continue;
      if (indicator.placement !== 'overlay') continue;

      if (indicator.type === 'volume') {
        const series = chart.addSeries('histogram');
        series.setData(visiblePrices.map((p): HistogramDataPoint => ({
          time:  p.timestamp,
          value: p.volume,
          color: p.close >= p.open ? `${indicator.color}55` : '#ef444455',
        })));
        indicatorSeriesRefs.current.set(indicator.id, series);
      } else if (indicator.type === 'bb') {
        const bands        = bbBandDataMap.get(indicator.id);
        const middleSeries = chart.addSeries('line', { color: indicator.color, lineWidth: indicator.lineWidth });
        middleSeries.setData(indicatorDataMap.get(indicator.id) ?? []);
        indicatorSeriesRefs.current.set(indicator.id, middleSeries);
        const bandLW     = Math.max(1, indicator.lineWidth * 0.7);
        const upperSeries = chart.addSeries('line', { color: indicator.color, lineWidth: bandLW });
        upperSeries.setData(bands?.upper ?? []);
        const lowerSeries = chart.addSeries('line', { color: indicator.color, lineWidth: bandLW });
        lowerSeries.setData(bands?.lower ?? []);
        bbSeriesRefs.current.set(indicator.id, { upper: upperSeries, lower: lowerSeries });
      } else if (indicator.type === 'fractals') {
        // Drawn via the fractals plugin — no series needed
      } else {
        const series = chart.addSeries('line', { color: indicator.color, lineWidth: indicator.lineWidth });
        series.setData(indicatorDataMap.get(indicator.id) ?? []);
        indicatorSeriesRefs.current.set(indicator.id, series);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, indicators, indicatorDataMap, bbBandDataMap]);

  // ── Live data updates ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    updateData(visiblePrices, candleSeriesRef.current, chartType);

    for (const indicator of indicators) {
      if (indicator.placement !== 'overlay') continue;
      const series = indicatorSeriesRefs.current.get(indicator.id);
      if (!series) continue;
      if (indicator.type === 'volume') {
        series.setData(visiblePrices.map((p): HistogramDataPoint => ({
          time:  p.timestamp,
          value: p.volume,
          color: p.close >= p.open ? `${indicator.color}55` : '#ef444455',
        })));
      } else {
        series.setData(indicatorDataMap.get(indicator.id) ?? []);
        if (indicator.type === 'bb') {
          const bands = bbBandDataMap.get(indicator.id);
          const bb    = bbSeriesRefs.current.get(indicator.id);
          bb?.upper.setData(bands?.upper ?? []);
          bb?.lower.setData(bands?.lower ?? []);
        }
      }
    }
  }, [visiblePrices, indicators, indicatorDataMap, chartType]);

  // ── Theme ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    chartRef.current?.setTheme(isDark ? darkTheme : lightTheme);
  }, [isDark]);

  // ── Fractal data for plugin ───────────────────────────────────────────────────

  useEffect(() => {
    const fractalIndicators = indicators.filter((i) => i.type === 'fractals');
    fractalDataRef.current.clear();
    for (const indicator of fractalIndicators) {
      const { up, down } = computeFractals(priceData);
      fractalDataRef.current.set(indicator.id, {
        up, down,
        color:   indicator.color,
        visible: indicator.visible,
      });
    }
    if (fractalIndicators.length > 0) {
      chartRef.current?.requestDraw();
    }
  }, [priceData, indicators]);

  // ── Interaction mode ─────────────────────────────────────────────────────────

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setCrosshairMeasureEnabled(false);

    const DRAW_TOOLS: InteractionMode[] = [
      'horizontalLine', 'trendLine', 'box', 'arrow', 'arrowUp', 'arrowDown', 'fibonacci',
    ];
    const isDrawTool = DRAW_TOOLS.includes(interactionMode);

    if (navigationTool === 'hand') {
      chart.setInteractionMode(null);
      chart.setPanEnabled(true);
      chart.setChartCursorMode('grab');
      return;
    }

    if (isDrawTool) {
      chart.setInteractionMode(interactionMode);
      chart.setPanEnabled(false);
      chart.setChartCursorMode('crosshair');
      return;
    }

    if (navigationTool === 'crosshair') {
      chart.setInteractionMode(null);
      chart.setPanEnabled(false);
      chart.setChartCursorMode('crosshair');
      chart.setCrosshairMeasureEnabled(true);
      return;
    }

    chart.setInteractionMode('select');
    chart.setPanEnabled(false);
    chart.setChartCursorMode('default');
  }, [interactionMode, navigationTool]);

  // ── Dropdown close on outside click ─────────────────────────────────────────

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (timeframeDropdownRef.current?.contains(target)) return;
      if (chartTypeDropdownRef.current?.contains(target)) return;
      setTimeframeOpen(false);
      setChartTypeOpen(false);
      setWeeklyOpen(false);
    };
    if (timeframeOpen || chartTypeOpen) {
      setTimeout(() => document.addEventListener('click', close));
      return () => document.removeEventListener('click', close);
    }
  }, [timeframeOpen, chartTypeOpen]);

  // ── Viewport sync (RAF loop) ─────────────────────────────────────────────────

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const chart = chartRef.current;
      if (chart) {
        const viewport     = chart.getViewport();
        const dataManager  = chart.getDataManager();
        const totalBars    = dataManager.getTotalBars();
        if (totalBars > 0) {
          const range = viewport.getVisibleRange(totalBars);
          const next = {
            start:      range.startIndex,
            end:        range.endIndex,
            totalBars,
            chartWidth: Math.max(0, viewport.chartWidth),
            barSpacing: viewport.barSpacing,
          };
          setViewportSync((prev) => (
            !prev ||
              prev.start      !== next.start      ||
              prev.end        !== next.end        ||
              prev.totalBars  !== next.totalBars  ||
              Math.abs(prev.chartWidth - next.chartWidth) > 0.5 ||
              Math.abs(prev.barSpacing - next.barSpacing) > 0.01
              ? next
              : prev
          ));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Callbacks ────────────────────────────────────────────────────────────────

  // Imperative crosshair broadcast from indicator panels → main chart and sibling panels
  const handleIndicatorCrosshairX = useCallback((x: number | null) => {
    chartRef.current?.setCrosshairX(x);
    for (const handle of panelHandlesRef.current.values()) {
      handle.notifyCrosshairX(x);
    }
  }, []);

  const handleChangeInteractionMode = useCallback((mode: InteractionMode) => {
    setNavigationTool('select');
    setInteractionMode(mode);
  }, []);

  const handleChangeNavigationTool = useCallback((tool: NavigationTool) => {
    setNavigationTool(tool);
    setInteractionMode(tool === 'select' ? 'select' : null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    chartRef.current?.deleteSelectedDrawing();
  }, []);

  const handleFibLevelsChange = useCallback((levels: FibLevel[]) => {
    setFibLevels(levels);
    if (!selectedDrawingId || !chartRef.current) return;
    const tool = chartRef.current.getDrawingManager().getDrawing(selectedDrawingId);
    if (tool) {
      tool.config.fibLevels = levels;
      chartRef.current.requestDraw();
    }
  }, [selectedDrawingId]);

  const addIndicatorFromCatalog = useCallback((entry: {
    type: IndicatorType; color: string; placement: IndicatorPlacement;
  }) => {
    const id = `${entry.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const defaults: Record<string, Partial<IndicatorConfig>> = {
      ao:       { period: 5,  source: 'median' },
      rsi:      { period: 14, overbought: 70, oversold: 30 },
      macd:     { period: 12, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      atr:      { period: 14 },
      bb:       { period: 20, bbStdDev: 2 },
      volume:   { period: 1 },
      fractals: { period: 5 },
    };
    const d = defaults[entry.type] ?? {};
    setIndicators((prev) => [
      ...prev,
      {
        id,
        type:      entry.type,
        placement: entry.placement,
        period:    d.period ?? 9,
        color:     entry.color,
        visible:   true,
        source:    d.source ?? 'close',
        offset:    0,
        lineWidth: 1.8,
        style:     'solid',
        ...d,
      },
    ]);
  }, []);

  const updateIndicator = useCallback((id: string, patch: Partial<IndicatorConfig>) => {
    setIndicators((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setIndicators((prev) => prev.filter((i) => i.id !== id));
    setSettingsIndicatorId((curr) => (curr === id ? null : curr));
  }, []);

  const copyIndicator = useCallback((id: string) => {
    setIndicators((prev) => {
      const src = prev.find((i) => i.id === id);
      if (!src) return prev;
      return [...prev, {
        ...src,
        id: `${src.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        period: Math.max(2, src.period),
      }];
    });
  }, []);

  const toggleFavoriteIndicator = useCallback((key: string) => {
    setFavoriteIndicatorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [key, ...prev],
    );
  }, []);

  const favoriteCatalogEntries = useMemo(
    () => INDICATOR_CATALOG.filter((entry) => favoriteIndicatorKeys.includes(entry.key)),
    [favoriteIndicatorKeys],
  );

  const handleChartPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportSync) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { start, end, chartWidth, barSpacing } = viewportSync;
    if (x < 0 || x > chartWidth) { setHoverIndex(null); return; }
    const idx = Math.round(start + (x - barSpacing / 2) / barSpacing);
    setHoverIndex(Math.max(start, Math.min(end, idx)));
  }, [viewportSync]);

  const settingsIndicator = indicators.find((i) => i.id === settingsIndicatorId) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-1.5">
      {/* Top bar */}
      <div className="nodrag flex items-center gap-2">
        <span className="text-sm font-semibold text-white/90">{ticker}</span>
        <span className="text-sm text-white font-mono">{lastBar ? lastBar.close.toFixed(decimals) : '--'}</span>
        <span className={`text-[11px] font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {changePips >= 0 ? '+' : ''}{changePips}p ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </span>

        <div className="flex-1" />

        {/* Timeframe picker */}
        <div ref={timeframeDropdownRef} className="relative">
          <button
            onClick={() => setTimeframeOpen((o) => !o)}
            className="px-2.5 h-7 rounded-md text-xs text-slate-200 bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700/80 flex items-center gap-1"
          >
            <span>{timeframe}</span>
            <ChevronSmallIcon open={timeframeOpen} />
          </button>
          {timeframeOpen && (
            <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-lg bg-slate-900/95 border border-slate-700/70 shadow-xl p-1.5">
              <div className="grid grid-cols-5 gap-1 pb-1.5 border-b border-slate-700/60">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      if (tf === 'W') { setWeeklyOpen((o) => !o); return; }
                      setTimeframe(tf); setTimeframeOpen(false);
                    }}
                    className={`h-6 rounded text-[11px] ${timeframe === tf ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-300 hover:bg-slate-700/70'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              {weeklyOpen && (
                <div className="pt-1 flex gap-1">
                  {WEEKLY_TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => { setTimeframe(tf); setTimeframeOpen(false); setWeeklyOpen(false); }}
                      className={`px-2 h-6 rounded text-[11px] ${timeframe === tf ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-300 hover:bg-slate-700/70'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart type picker */}
        <div ref={chartTypeDropdownRef} className="relative">
          <button
            onClick={() => setChartTypeOpen((o) => !o)}
            className="px-2.5 h-7 rounded-md text-xs text-slate-200 bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700/80 flex items-center gap-1"
          >
            <span>{chartLabel}</span>
            <ChevronSmallIcon open={chartTypeOpen} />
          </button>
          {chartTypeOpen && (
            <div className="absolute right-0 top-full mt-1 z-40 w-36 rounded-lg bg-slate-900/95 border border-slate-700/70 shadow-xl p-1">
              {CHART_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setChartType(opt.value); setChartTypeOpen(false); }}
                  className={`w-full text-left px-2 py-1 rounded text-[11px] ${chartType === opt.value ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-300 hover:bg-slate-700/70'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIndicatorsModalOpen(true)}
          className="px-2.5 h-7 rounded-md text-xs text-slate-200 bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700/80 flex items-center gap-1"
        >
          <IndicatorsIcon />
          <span>Indicators</span>
          <span className="text-[10px] text-slate-400">({indicators.length})</span>
        </button>

        <ThemeSwitch isDark={isDark} onChange={setIsDark} />
      </div>

      {/* Chart area */}
      <div ref={chartAreaRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden gap-px">

        {/* Main chart pane */}
        <div
          ref={chartPaneHostRef}
          className={`relative nodrag flex-1 overflow-hidden ${bottomIndicators.length > 0 ? 'min-h-[40%]' : 'min-h-0'}`}
          onPointerMove={handleChartPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />

          {/* Watermark */}
          <div className="absolute inset-0 z-[1] pointer-events-none flex items-center justify-center">
            <span className="text-[88px] leading-none font-bold tracking-[0.12em] text-slate-300/10 select-none">
              {ticker}
            </span>
          </div>

          {/* Active indicators overlay */}
          <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5 pointer-events-none">
            <div className="pointer-events-auto">
              <button
                onClick={() => setOverlayOpen((o) => !o)}
                className="flex items-center gap-1 h-6 px-1.5 rounded bg-slate-900/75 border border-slate-700/60 text-slate-200 text-[11px]"
              >
                <IndicatorsIcon />
                <span>Indicators</span>
                <ChevronSmallIcon open={overlayOpen} />
              </button>
              {overlayOpen && (
                <div className="mt-1 w-[300px] max-h-52 overflow-auto rounded-lg bg-slate-900/95 border border-slate-700/70 shadow-xl p-1.5">
                  {indicators.length === 0 && (
                    <div className="text-[11px] text-slate-500 px-1 py-1">No active indicators</div>
                  )}
                  {indicators.map((indicator) => {
                    const rowValue  = indicatorDataMap.get(indicator.id)?.[pointIndex]?.value ?? null;
                    const valDecimals = indicator.placement === 'bottom' ? 2 : decimals;
                    return (
                      <div key={indicator.id} className="group rounded border border-slate-700/70 bg-slate-800/65 px-1.5 py-1 mb-1 last:mb-0">
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: indicator.color }} />
                          <span className="text-[11px] text-slate-200 flex-1">{indicatorLabel(indicator)}</span>
                          {indicator.placement === 'bottom' && (
                            <span className="text-[9px] text-slate-500 bg-slate-700/50 px-1 rounded">panel</span>
                          )}
                          <span className="text-[11px] font-mono text-slate-300">
                            {rowValue == null ? '--' : rowValue.toFixed(valDecimals)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400 flex items-center gap-2">
                          <span>{hoverIndex == null ? 'Last' : 'Crosshair'}</span>
                          {indicator.placement !== 'bottom' && <span>src:{indicator.source}</span>}
                          {indicator.placement !== 'bottom' && <span>off:{indicator.offset}</span>}
                        </div>
                        <div className="hidden group-hover:flex mt-1 items-center gap-1">
                          <TinyActionButton label={indicator.visible ? 'Hide' : 'View'} onClick={() => updateIndicator(indicator.id, { visible: !indicator.visible })} />
                          <TinyActionButton label="Settings" onClick={() => setSettingsIndicatorId(indicator.id)} />
                          <TinyActionButton label="Delete"   onClick={() => removeIndicator(indicator.id)} />
                          <TinyActionButton label="Copy"     onClick={() => copyIndicator(indicator.id)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DrawingToolbar
            activeMode={interactionMode}
            activeNavigationTool={navigationTool}
            selectedDrawingId={selectedDrawingId}
            onChangeMode={handleChangeInteractionMode}
            onChangeNavigationTool={handleChangeNavigationTool}
            onDeleteSelected={handleDeleteSelected}
          />

          {fibEditorOpen && (
            <FibLevelEditor
              levels={fibLevels}
              onChange={handleFibLevelsChange}
              onClose={() => setFibEditorOpen(false)}
            />
          )}
        </div>

        {/* Bottom indicator panels */}
        {bottomIndicators.map((indicator) => (
          <IndicatorPanel
            key={indicator.id}
            ref={(handle) => {
              if (handle) panelHandlesRef.current.set(indicator.id, handle);
              else panelHandlesRef.current.delete(indicator.id);
            }}
            indicatorId={indicator.id}
            label={indicatorLabel(indicator)}
            visible={indicator.visible}
            data={bottomPanelDataMap.get(indicator.id)}
            viewportSync={viewportSync}
            theme={isDark ? darkTheme : lightTheme}
            hoverIndex={hoverIndex}
            onRemove={() => removeIndicator(indicator.id)}
            onSettings={() => setSettingsIndicatorId(indicator.id)}
            onToggleVisibility={() => updateIndicator(indicator.id, { visible: !indicator.visible })}
            onPointerIndex={setHoverIndex}
            onPointerX={handleIndicatorCrosshairX}
          />
        ))}

        {/* Time scale */}
        <div className="relative nodrag shrink-0 grow-0" style={{ height: `${TIME_SCALE_HEIGHT}px` }}>
          <TimescaleRow
            prices={visiblePrices}
            viewportSync={viewportSync}
            chartWidth={viewportSync?.chartWidth ?? 0}
            theme={isDark ? darkTheme : lightTheme}
            onZoomX={(factor, centerX) => chartRef.current?.zoomX(factor, centerX)}
          />
        </div>

        {/* Indicators modal */}
        {indicatorsModalOpen && (
          <div className="absolute inset-0 z-30 nodrag bg-black/35 backdrop-blur-[1px] flex items-start justify-center pt-10">
            <div className="w-[520px] max-w-[92%] rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/70">
                <div className="text-sm font-semibold text-slate-100">Indicators Center</div>
                <button className="text-slate-400 hover:text-slate-200 text-sm" onClick={() => setIndicatorsModalOpen(false)}>✕</button>
              </div>

              <div className="px-3 pt-2 flex gap-1">
                {(['indicators', 'strategies', 'patterns'] as IndicatorsTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setIndicatorsTab(tab)}
                    className={`px-2.5 h-7 rounded text-xs capitalize ${indicatorsTab === tab ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-300 bg-slate-800/75 hover:bg-slate-700/75'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-3 pt-2">
                {indicatorsTab === 'indicators' && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-md border border-slate-700/70 bg-slate-800/50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Favourites</div>
                      {favoriteCatalogEntries.length === 0 ? (
                        <div className="text-[11px] text-slate-500">No favourites yet</div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {favoriteCatalogEntries.map((entry) => (
                            <button
                              key={`fav_${entry.key}`}
                              disabled={!entry.enabled}
                              onClick={() => {
                                if (!entry.type || !entry.color || !entry.placement) return;
                                addIndicatorFromCatalog({ type: entry.type, color: entry.color, placement: entry.placement });
                              }}
                              className={`h-7 rounded px-2 text-left text-[11px] ${entry.enabled ? 'text-slate-200 bg-slate-700/60 hover:bg-slate-700/80' : 'text-slate-500 bg-slate-900/60 cursor-not-allowed'}`}
                            >
                              {entry.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {INDICATOR_CATALOG.map((entry) => (
                      <div
                        key={entry.key}
                        className={`rounded-md border px-2 py-1.5 flex items-center gap-2 ${entry.enabled ? 'border-slate-700/70 bg-slate-800/70' : 'border-slate-800 bg-slate-900'}`}
                      >
                        <button
                          onClick={() => toggleFavoriteIndicator(entry.key)}
                          className={`${favoriteIndicatorKeys.includes(entry.key) ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Toggle favourite"
                        >
                          {favoriteIndicatorKeys.includes(entry.key) ? '★' : '☆'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs truncate ${entry.enabled ? 'text-slate-200' : 'text-slate-500'}`}>{entry.label}</div>
                          <div className="text-[10px] text-slate-500">
                            {!entry.enabled
                              ? 'Not available yet'
                              : entry.key === 'volume'
                                ? 'Overlay on main chart'
                                : entry.key === 'fractals'
                                  ? '5-bar Williams Fractal pattern'
                                  : entry.placement === 'bottom'
                                    ? 'Bottom panel indicator'
                                    : 'Default rolling window: 9'}
                          </div>
                        </div>
                        <button
                          disabled={!entry.enabled}
                          onClick={() => {
                            if (!entry.type || !entry.color || !entry.placement) return;
                            addIndicatorFromCatalog({ type: entry.type, color: entry.color, placement: entry.placement });
                          }}
                          className={`h-7 px-2 rounded text-[11px] ${entry.enabled ? 'text-cyan-200 bg-cyan-600/20 hover:bg-cyan-600/30' : 'text-slate-500 bg-slate-900 cursor-not-allowed'}`}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {indicatorsTab === 'strategies' && (
                  <div className="grid grid-cols-2 gap-2">
                    {STRATEGY_CATALOG.map((name) => (
                      <div key={name} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-slate-500 text-xs">
                        {name} (coming soon)
                      </div>
                    ))}
                  </div>
                )}

                {indicatorsTab === 'patterns' && (
                  <div className="grid grid-cols-2 gap-2">
                    {PATTERN_CATALOG.map((name) => (
                      <div key={name} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-slate-500 text-xs">
                        {name} (coming soon)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Indicator settings modal */}
        {settingsIndicator && (
          <div className="absolute inset-0 z-40 nodrag bg-black/30 flex items-start justify-center pt-12">
            <div className="w-[360px] max-w-[92%] rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-2xl p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/70">
                <div className="text-sm font-semibold text-slate-100">{indicatorLabel(settingsIndicator)} Settings</div>
                <button className="text-slate-400 hover:text-slate-200" onClick={() => setSettingsIndicatorId(null)}>✕</button>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-slate-200">
                <label className="flex flex-col gap-1">
                  <span>Color</span>
                  <input
                    type="color"
                    value={settingsIndicator.color}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { color: e.target.value })}
                    className="h-8 rounded bg-transparent"
                  />
                </label>

                {settingsIndicator.type !== 'volume' && settingsIndicator.type !== 'fractals' && <>
                  <label className="flex flex-col gap-1">
                    <span>Length</span>
                    <input type="number" min={2} max={300} value={settingsIndicator.period}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { period: Math.max(2, Math.min(300, Number(e.target.value) || 2)) })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Source</span>
                    <select value={settingsIndicator.source}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { source: e.target.value as IndicatorSource })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700">
                      <option value="close">Close</option>
                      <option value="open">Open</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                      <option value="median">Median (H+L/2)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Offset</span>
                    <input type="number" min={-100} max={100} value={settingsIndicator.offset}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { offset: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Styling</span>
                    <select value={settingsIndicator.style}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { style: e.target.value as IndicatorStyle })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700">
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Line Width</span>
                    <input type="number" min={1} max={6} step={0.2} value={settingsIndicator.lineWidth}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { lineWidth: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                  </label>
                </>}

                {settingsIndicator.type === 'bb' && (
                  <label className="flex flex-col gap-1">
                    <span>Std Deviations</span>
                    <input type="number" min={0.5} max={5} step={0.5} value={settingsIndicator.bbStdDev ?? 2}
                      onChange={(e) => updateIndicator(settingsIndicator.id, { bbStdDev: Math.max(0.5, Math.min(5, Number(e.target.value) || 2)) })}
                      className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                  </label>
                )}

                {settingsIndicator.type === 'rsi' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span>Overbought</span>
                      <input type="number" min={50} max={100} value={settingsIndicator.overbought ?? 70}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { overbought: Math.max(50, Math.min(100, Number(e.target.value) || 70)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Oversold</span>
                      <input type="number" min={0} max={50} value={settingsIndicator.oversold ?? 30}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { oversold: Math.max(0, Math.min(50, Number(e.target.value) || 30)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                    </label>
                  </>
                )}

                {settingsIndicator.type === 'macd' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span>Fast Period</span>
                      <input type="number" min={2} max={100} value={settingsIndicator.fastPeriod ?? 12}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { fastPeriod: Math.max(2, Math.min(100, Number(e.target.value) || 12)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Slow Period</span>
                      <input type="number" min={2} max={200} value={settingsIndicator.slowPeriod ?? 26}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { slowPeriod: Math.max(2, Math.min(200, Number(e.target.value) || 26)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Signal Period</span>
                      <input type="number" min={2} max={100} value={settingsIndicator.signalPeriod ?? 9}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { signalPeriod: Math.max(2, Math.min(100, Number(e.target.value) || 9)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700" />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function TinyActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-5 px-1.5 rounded text-[10px] text-slate-300 bg-slate-700/70 hover:bg-slate-600/80"
    >
      {label}
    </button>
  );
}

function ChevronSmallIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform 120ms ease' }}>
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

function ThemeSwitch({ isDark, onChange }: { isDark: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!isDark)}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      className="nodrag relative flex items-center w-10 h-5 rounded-full transition-colors duration-200"
      style={{ background: isDark ? '#1e293b' : '#cbd5e1' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full shadow transition-all duration-200"
        style={{ left: isDark ? '2px' : '22px', background: isDark ? '#334155' : '#fbbf24' }}
      />
    </button>
  );
}

function IndicatorsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 5-8" />
    </svg>
  );
}

// ── Time scale row ────────────────────────────────────────────────────────────

const ZOOM_SENSITIVITY = 0.005;

function TimescaleRow({
  prices, viewportSync, chartWidth, theme, onZoomX,
}: {
  prices: { timestamp: number }[];
  viewportSync: { start: number; end: number; totalBars: number; chartWidth: number; barSpacing: number } | null;
  chartWidth: number;
  theme: Theme;
  onZoomX: (factor: number, centerX: number) => void;
}) {
  const lastXRef = useRef<number | null>(null);
  const start    = viewportSync?.start ?? Math.max(0, prices.length - 40);
  const end      = viewportSync?.end   ?? Math.max(0, prices.length - 1);
  const count    = Math.max(1, end - start + 1);
  const barSpacing = viewportSync?.barSpacing ?? (chartWidth / count);
  const step = Math.max(1, Math.floor(count / 6));
  const width = Math.max(120, Math.floor(chartWidth));
  const effectiveChartWidth = viewportSync?.chartWidth ?? chartWidth;
  const { colors, fontSize, fontFamily } = theme;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    lastXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (lastXRef.current === null) return;
    const dx     = e.clientX - lastXRef.current;
    const factor = 1 - dx * ZOOM_SENSITIVITY;
    onZoomX(factor, effectiveChartWidth / 2);
    lastXRef.current = e.clientX;
  }, [onZoomX, effectiveChartWidth]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    lastXRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerLeave = useCallback(() => { lastXRef.current = null; }, []);

  return (
    <div
      className="h-full overflow-hidden cursor-ew-resize select-none"
      style={{ background: colors.background }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <svg width={width} height={TIME_SCALE_HEIGHT - 2} viewBox={`0 0 ${width} ${TIME_SCALE_HEIGHT - 2}`} preserveAspectRatio="none">
        <line x1="0" y1="0" x2={width} y2="0" stroke={colors.border} strokeWidth="1" />
        {Array.from({ length: count }).map((_, idx) => {
          if (idx % step !== 0 && idx !== count - 1) return null;
          const barIndex = start + idx;
          const x = (idx + 0.5) * barSpacing;
          if (x < 0 || x > width) return null;
          const ts = prices[barIndex]?.timestamp;
          if (!ts) return null;
          return (
            <g key={`ts_${barIndex}`}>
              <line x1={x} y1={0} x2={x} y2={6} stroke={colors.grid} strokeWidth="1" />
              <text x={x} y={18} fill={colors.text} fontSize={fontSize} fontFamily={fontFamily} textAnchor="middle">
                {formatTimeShort(ts)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function formatTimeShort(timestamp: number): string {
  const d     = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function updateData(
  prices: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[],
  mainSeries: SeriesHandle,
  chartType: ChartType,
): void {
  if (chartType === 'line') {
    mainSeries.setData(prices.map((p) => ({ time: p.timestamp, value: p.close })));
  } else {
    mainSeries.setData(prices.map((p): OHLCV => ({
      time: p.timestamp, open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume,
    })));
  }
}
