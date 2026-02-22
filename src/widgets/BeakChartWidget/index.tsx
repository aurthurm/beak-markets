import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Chart, darkTheme, lightTheme } from '@beak/charts';
import type { Theme } from '@beak/charts';
import type {
  SeriesHandle,
  OHLCV,
  HistogramDataPoint,
  LineDataPoint,
  InteractionMode,
} from '@beak/charts';
import { marketService } from '../../services/marketService';
import { useSimulationStore } from '../../store/useSimulationStore';
import { DrawingToolbar, type NavigationTool } from './DrawingToolbar';
import IndicatorPanel from './IndicatorPanel';

type Props = { ticker: string };
type ChartType = 'candlestick' | 'bar' | 'line';
type Timeframe = '15m' | '1h' | '4h' | 'D' | 'W' | '2W' | '1M';
type IndicatorType = 'sma' | 'ema' | 'ao' | 'rsi' | 'macd';
type IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'median';
type IndicatorStyle = 'solid' | 'dashed' | 'dotted';
type IndicatorsTab = 'indicators' | 'strategies' | 'patterns';
type IndicatorPlacement = 'overlay' | 'bottom';
const TIME_SCALE_HEIGHT = 24;

type IndicatorConfig = {
  id: string;
  type: IndicatorType;
  placement: IndicatorPlacement;
  period: number;
  color: string;
  visible: boolean;
  source: IndicatorSource;
  offset: number;
  lineWidth: number;
  style: IndicatorStyle;
  overbought?: number;
  oversold?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
};

type BottomIndicatorData = {
  lines: Array<{ label: string; color: string; values: (number | null)[] }>;
  histogram?: { values: (number | null)[]; upColor: string; downColor: string };
  referenceLines?: Array<{ value: number; color: string; dashed: boolean }>;
  yRange?: { min: number; max: number };
};

const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', 'D', 'W'];
const WEEKLY_TIMEFRAMES: Timeframe[] = ['W', '2W', '1M'];

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Candlestick' },
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
];

const INDICATOR_CATALOG: {
  key: string;
  label: string;
  type?: IndicatorType;
  color?: string;
  placement?: IndicatorPlacement;
  enabled: boolean;
}[] = [
  { key: 'sma', label: 'Simple Moving Average (SMA)', type: 'sma', color: '#22d3ee', placement: 'overlay', enabled: true },
  { key: 'ema', label: 'Exponential Moving Average (EMA)', type: 'ema', color: '#f59e0b', placement: 'overlay', enabled: true },
  { key: 'ao', label: 'Awesome Oscillator', type: 'ao', color: '#a78bfa', placement: 'bottom', enabled: true },
  { key: 'rsi', label: 'Relative Strength Index (RSI)', type: 'rsi', color: '#a855f7', placement: 'bottom', enabled: true },
  { key: 'macd', label: 'MACD', type: 'macd', color: '#06b6d4', placement: 'bottom', enabled: true },
  { key: 'bb', label: 'Bollinger Bands', enabled: false },
];

const STRATEGY_CATALOG = ['Mean Reversion', 'Breakout', 'Trend Follow'];
const PATTERN_CATALOG = ['Double Top', 'Head & Shoulders', 'Triangle'];

export default function BeakChartWidget({ ticker }: Props) {
  const currentIndex = useSimulationStore((s) => s.currentIndex);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const chartPaneHostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const candleSeriesRef = useRef<SeriesHandle | null>(null);
  const volumeSeriesRef = useRef<SeriesHandle | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, SeriesHandle>>(new Map());

  const timeframeDropdownRef = useRef<HTMLDivElement>(null);
  const chartTypeDropdownRef = useRef<HTMLDivElement>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [chartTypeOpen, setChartTypeOpen] = useState(false);

  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [indicatorsTab, setIndicatorsTab] = useState<IndicatorsTab>('indicators');
  const [favoriteIndicatorKeys, setFavoriteIndicatorKeys] = useState<string[]>(['sma']);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [settingsIndicatorId, setSettingsIndicatorId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [isDark, setIsDark] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');
  const [navigationTool, setNavigationTool] = useState<NavigationTool>('select');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [viewportSync, setViewportSync] = useState<{ start: number; end: number; totalBars: number; chartWidth: number; barSpacing: number } | null>(null);

  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const visiblePrices = useMemo(() => dataset.prices.slice(0, currentIndex + 1), [dataset, currentIndex]);

  const lastBar = visiblePrices[visiblePrices.length - 1];
  const prevBar = visiblePrices.length > 1 ? visiblePrices[visiblePrices.length - 2] : lastBar;
  const change = lastBar ? lastBar.close - prevBar!.close : 0;
  const { pipSize, decimals } = marketService.getTickerDisplayInfo(ticker);
  const changePips = Math.round(change / pipSize);
  const changePct = prevBar ? (change / prevBar.close) * 100 : 0;

  const chartLabel = useMemo(
    () => CHART_TYPE_OPTIONS.find((o) => o.value === chartType)?.label ?? 'Candlestick',
    [chartType],
  );

  const indicatorDataMap = useMemo(() => {
    const m = new Map<string, LineDataPoint[]>();
    for (const indicator of indicators) {
      m.set(indicator.id, computeIndicatorData(visiblePrices, indicator));
    }
    return m;
  }, [visiblePrices, indicators]);

  const bottomPanelDataMap = useMemo(() => {
    const m = new Map<string, BottomIndicatorData>();
    for (const indicator of indicators) {
      if (indicator.placement !== 'bottom') continue;
      m.set(indicator.id, computeBottomPanelData(visiblePrices, indicator));
    }
    return m;
  }, [visiblePrices, indicators]);

  const bottomIndicators = useMemo(
    () => indicators.filter((i) => i.placement === 'bottom'),
    [indicators],
  );

  const pointIndex = Math.min(
    Math.max(hoverIndex ?? visiblePrices.length - 1, 0),
    Math.max(visiblePrices.length - 1, 0),
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = new Chart(container, {
      autoSize: true,
      theme: isDark ? darkTheme : lightTheme,
      timeScale: { height: 0 },
    });
    const indicatorSeriesMap = indicatorSeriesRefs.current;

    chart.onDrawingChange((event) => {
      if (event.type === 'selected') setSelectedDrawingId(event.drawingId);
      if (event.type === 'deleted') setSelectedDrawingId(null);
    });
    chart.setInteractionMode('select');
    chartRef.current = chart;

    return () => {
      chart.onDrawingChange(null);
      chart.destroy();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    candleSeriesRef.current?.remove();
    volumeSeriesRef.current?.remove();
    for (const h of indicatorSeriesRefs.current.values()) h.remove();
    indicatorSeriesRefs.current.clear();

    const mainSeries = chartType === 'candlestick'
      ? chart.addSeries('candlestick')
      : chartType === 'bar'
        ? chart.addSeries('bar')
        : chart.addSeries('line');

    const volumeSeries = chart.addSeries('histogram');
    candleSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;

    updateData(visiblePrices, mainSeries, volumeSeries, chartType);

    for (const indicator of indicators) {
      if (!indicator.visible) continue;
      if (indicator.placement !== 'overlay') continue;
      const series = chart.addSeries('line', {
        color: indicator.color,
        lineWidth: indicator.lineWidth,
      });
      series.setData(indicatorDataMap.get(indicator.id) ?? []);
      indicatorSeriesRefs.current.set(indicator.id, series);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, indicators, indicatorDataMap]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    updateData(visiblePrices, candleSeriesRef.current, volumeSeriesRef.current, chartType);

    for (const indicator of indicators) {
      if (indicator.placement !== 'overlay') continue;
      const series = indicatorSeriesRefs.current.get(indicator.id);
      if (!series) continue;
      series.setData(indicatorDataMap.get(indicator.id) ?? []);
    }
  }, [visiblePrices, indicators, indicatorDataMap, chartType]);

  useEffect(() => {
    chartRef.current?.setTheme(isDark ? darkTheme : lightTheme);
  }, [isDark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setCrosshairMeasureEnabled(false);

    const isDrawTool =
      interactionMode === 'horizontalLine' ||
      interactionMode === 'trendLine' ||
      interactionMode === 'box' ||
      interactionMode === 'arrow' ||
      interactionMode === 'arrowUp' ||
      interactionMode === 'arrowDown';

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

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const chart = chartRef.current;
      if (chart) {
        const viewport = chart.getViewport();
        const dataManager = chart.getDataManager();
        const totalBars = dataManager.getTotalBars();
        if (totalBars > 0) {
          const range = viewport.getVisibleRange(totalBars);
          const next = {
            start: range.startIndex,
            end: range.endIndex,
            totalBars,
            chartWidth: Math.max(0, viewport.chartWidth),
            barSpacing: viewport.barSpacing,
          };
          setViewportSync((prev) => (
            !prev ||
            prev.start !== next.start ||
            prev.end !== next.end ||
            prev.totalBars !== next.totalBars ||
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

  const handleChangeInteractionMode = useCallback((mode: InteractionMode) => {
    setNavigationTool('select');
    setInteractionMode(mode);
  }, []);

  const handleChangeNavigationTool = useCallback((tool: NavigationTool) => {
    setNavigationTool(tool);
    if (tool === 'select') {
      setInteractionMode('select');
    } else {
      setInteractionMode(null);
    }
  }, []);

  const handleDeleteSelected = useCallback(() => {
    chartRef.current?.deleteSelectedDrawing();
  }, []);

  const addIndicatorFromCatalog = useCallback((entry: {
    type: IndicatorType;
    color: string;
    placement: IndicatorPlacement;
  }) => {
    const id = `${entry.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const defaults: Record<string, Partial<IndicatorConfig>> = {
      ao: { period: 5, source: 'median' },
      rsi: { period: 14, overbought: 70, oversold: 30 },
      macd: { period: 12, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    };
    const d = defaults[entry.type] ?? {};
    setIndicators((prev) => [
      ...prev,
      {
        id,
        type: entry.type,
        placement: entry.placement,
        period: d.period ?? 9,
        color: entry.color,
        visible: true,
        source: d.source ?? 'close',
        offset: 0,
        lineWidth: 1.8,
        style: 'solid',
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
      const clone: IndicatorConfig = {
        ...src,
        id: `${src.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        period: Math.max(2, src.period),
      };
      return [...prev, clone];
    });
  }, []);

  const toggleFavoriteIndicator = useCallback((key: string) => {
    setFavoriteIndicatorKeys((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [key, ...prev]
    ));
  }, []);

  const favoriteCatalogEntries = useMemo(
    () => INDICATOR_CATALOG.filter((entry) => favoriteIndicatorKeys.includes(entry.key)),
    [favoriteIndicatorKeys],
  );

  const handleChartPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const viewport = chart.getViewport();
    const dataManager = chart.getDataManager();
    const totalBars = dataManager.getTotalBars();
    if (totalBars === 0 || x < 0 || x >= viewport.chartWidth) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.max(0, Math.min(totalBars - 1, viewport.xToBarIndex(x, totalBars)));
    setHoverIndex(idx);
  }, []);

  const settingsIndicator = indicators.find((i) => i.id === settingsIndicatorId) ?? null;

  return (
    <div className="flex flex-col h-full gap-1.5">
      <div className="nodrag flex items-center gap-2">
        <span className="text-sm font-semibold text-white/90">{ticker}</span>
        <span className="text-sm text-white font-mono">{lastBar ? lastBar.close.toFixed(decimals) : '--'}</span>
        <span className={`text-[11px] font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {changePips >= 0 ? '+' : ''}{changePips}p ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </span>

        <div className="flex-1" />

        <div ref={timeframeDropdownRef} className="relative">
          <button
            onClick={() => setTimeframeOpen((o) => !o)}
            className="px-2.5 h-7 rounded-md text-xs text-slate-200 bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700/80 flex items-center gap-1"
            title="Timeframe"
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
                      if (tf === 'W') {
                        setWeeklyOpen((o) => !o);
                        return;
                      }
                      setTimeframe(tf);
                      setTimeframeOpen(false);
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
                      onClick={() => {
                        setTimeframe(tf);
                        setTimeframeOpen(false);
                        setWeeklyOpen(false);
                      }}
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

        <div ref={chartTypeDropdownRef} className="relative">
          <button
            onClick={() => setChartTypeOpen((o) => !o)}
            className="px-2.5 h-7 rounded-md text-xs text-slate-200 bg-slate-800/80 border border-slate-700/70 hover:bg-slate-700/80 flex items-center gap-1"
            title="Chart Type"
          >
            <span>{chartLabel}</span>
            <ChevronSmallIcon open={chartTypeOpen} />
          </button>
          {chartTypeOpen && (
            <div className="absolute right-0 top-full mt-1 z-40 w-36 rounded-lg bg-slate-900/95 border border-slate-700/70 shadow-xl p-1">
              {CHART_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setChartType(opt.value);
                    setChartTypeOpen(false);
                  }}
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
          title="Indicators"
        >
          <IndicatorsIcon />
          <span>Indicators</span>
          <span className="text-[10px] text-slate-400">({indicators.length})</span>
        </button>

        <ThemeSwitch isDark={isDark} onChange={setIsDark} />
      </div>

      <div
        ref={chartAreaRef}
        className="relative flex-1 min-h-0 flex flex-col overflow-hidden gap-px"
      >
        {/* 1. Chart panel (top) - takes remaining space */}
        <div
          ref={chartPaneHostRef}
          className={`relative nodrag flex-1 overflow-hidden ${bottomIndicators.length > 0 ? 'min-h-[40%]' : 'min-h-0'}`}
          onPointerMove={handleChartPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 z-[1] pointer-events-none flex items-center justify-center">
            <span className="text-[88px] leading-none font-bold tracking-[0.12em] text-slate-300/10 select-none">
              {ticker}
            </span>
          </div>

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
                    const rowValue = indicatorDataMap.get(indicator.id)?.[pointIndex]?.value ?? null;
                    const valDecimals = indicator.placement === 'bottom' ? 2 : decimals;
                    return (
                      <div key={indicator.id} className="group rounded border border-slate-700/70 bg-slate-800/65 px-1.5 py-1 mb-1 last:mb-0">
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: indicator.color }} />
                          <span className="text-[11px] text-slate-200 flex-1">
                            {indicatorLabel(indicator)}
                          </span>
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
                          <TinyActionButton
                            label={indicator.visible ? 'Hide' : 'View'}
                            onClick={() => updateIndicator(indicator.id, { visible: !indicator.visible })}
                          />
                          <TinyActionButton
                            label="Settings"
                            onClick={() => setSettingsIndicatorId(indicator.id)}
                          />
                          <TinyActionButton label="Delete" onClick={() => removeIndicator(indicator.id)} />
                          <TinyActionButton label="Copy" onClick={() => copyIndicator(indicator.id)} />
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
        </div>

        {/* Bottom indicator panels */}
        {bottomIndicators.map((indicator) => (
          <IndicatorPanel
            key={indicator.id}
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
          />
        ))}

        {/* Timescale / X-axis (bottom) */}
        <div
          className="relative nodrag shrink-0 grow-0"
          style={{ height: `${TIME_SCALE_HEIGHT}px` }}
        >
          <TimescaleRow
            prices={visiblePrices}
            viewportSync={viewportSync}
            chartWidth={viewportSync?.chartWidth ?? 0}
            theme={isDark ? darkTheme : lightTheme}
            onZoomX={(factor, centerX) => chartRef.current?.zoomX(factor, centerX)}
          />
        </div>

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
                                if (!entry.enabled || !entry.type || !entry.color || !entry.placement) return;
                                addIndicatorFromCatalog({
                                  type: entry.type,
                                  color: entry.color,
                                  placement: entry.placement,
                                });
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
                              : entry.placement === 'bottom'
                                ? 'Bottom panel indicator'
                                : 'Default rolling window: 9'}
                          </div>
                        </div>

                        <button
                          disabled={!entry.enabled}
                          onClick={() => {
                            if (!entry.enabled || !entry.type || !entry.color || !entry.placement) return;
                            addIndicatorFromCatalog({
                              type: entry.type,
                              color: entry.color,
                              placement: entry.placement,
                            });
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

                <label className="flex flex-col gap-1">
                  <span>Length</span>
                  <input
                    type="number"
                    min={2}
                    max={300}
                    value={settingsIndicator.period}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { period: Math.max(2, Math.min(300, Number(e.target.value) || 2)) })}
                    className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span>Source</span>
                  <select
                    value={settingsIndicator.source}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { source: e.target.value as IndicatorSource })}
                    className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                  >
                    <option value="close">Close</option>
                    <option value="open">Open</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="median">Median (H+L/2)</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span>Offset</span>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={settingsIndicator.offset}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { offset: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })}
                    className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span>Styling</span>
                  <select
                    value={settingsIndicator.style}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { style: e.target.value as IndicatorStyle })}
                    className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span>Line Width</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    step={0.2}
                    value={settingsIndicator.lineWidth}
                    onChange={(e) => updateIndicator(settingsIndicator.id, { lineWidth: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
                    className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                  />
                </label>

                {settingsIndicator.type === 'rsi' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span>Overbought</span>
                      <input
                        type="number"
                        min={50}
                        max={100}
                        value={settingsIndicator.overbought ?? 70}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { overbought: Math.max(50, Math.min(100, Number(e.target.value) || 70)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Oversold</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={settingsIndicator.oversold ?? 30}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { oversold: Math.max(0, Math.min(50, Number(e.target.value) || 30)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                      />
                    </label>
                  </>
                )}

                {settingsIndicator.type === 'macd' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span>Fast Period</span>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={settingsIndicator.fastPeriod ?? 12}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { fastPeriod: Math.max(2, Math.min(100, Number(e.target.value) || 12)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Slow Period</span>
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={settingsIndicator.slowPeriod ?? 26}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { slowPeriod: Math.max(2, Math.min(200, Number(e.target.value) || 26)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Signal Period</span>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={settingsIndicator.signalPeriod ?? 9}
                        onChange={(e) => updateIndicator(settingsIndicator.id, { signalPeriod: Math.max(2, Math.min(100, Number(e.target.value) || 9)) })}
                        className="h-8 px-2 rounded bg-slate-800 border border-slate-700"
                      />
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
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform 120ms ease' }}>
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
        style={{
          left: isDark ? '2px' : '22px',
          background: isDark ? '#334155' : '#fbbf24',
        }}
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

const ZOOM_SENSITIVITY = 0.005;

function TimescaleRow({
  prices,
  viewportSync,
  chartWidth,
  theme,
  onZoomX,
}: {
  prices: { timestamp: number }[];
  viewportSync: { start: number; end: number; totalBars: number; chartWidth: number; barSpacing: number } | null;
  chartWidth: number;
  theme: Theme;
  onZoomX: (factor: number, centerX: number) => void;
}) {
  const lastXRef = useRef<number | null>(null);
  const start = viewportSync?.start ?? Math.max(0, prices.length - 40);
  const end = viewportSync?.end ?? Math.max(0, prices.length - 1);
  const count = Math.max(1, end - start + 1);
  const barSpacing = viewportSync?.barSpacing ?? (chartWidth / count);
  const step = Math.max(1, Math.floor(count / 6));
  const width = Math.max(120, Math.floor(chartWidth));
  const effectiveChartWidth = viewportSync?.chartWidth ?? chartWidth;
  const { colors, fontSize, fontFamily } = theme;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      lastXRef.current = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (lastXRef.current === null) return;
      const dx = e.clientX - lastXRef.current;
      const factor = 1 - dx * ZOOM_SENSITIVITY;
      const centerX = effectiveChartWidth / 2;
      onZoomX(factor, centerX);
      lastXRef.current = e.clientX;
    },
    [onZoomX, effectiveChartWidth],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    lastXRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerLeave = useCallback(() => {
    lastXRef.current = null;
  }, []);

  return (
    <div
      className="h-full overflow-hidden cursor-ew-resize select-none"
      style={{
        background: colors.background,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <svg width={width} height={TIME_SCALE_HEIGHT - 2} viewBox={`0 0 ${width} ${TIME_SCALE_HEIGHT - 2}`} preserveAspectRatio="none">
        {/* Top border line - matches Y-axis border */}
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
              {/* Tick mark - matches Y-axis grid style */}
              <line x1={x} y1={0} x2={x} y2={6} stroke={colors.grid} strokeWidth="1" />
              {/* Label - matches Y-axis text style */}
              <text
                x={x}
                y={18}
                fill={colors.text}
                fontSize={fontSize}
                fontFamily={fontFamily}
                textAnchor="middle"
              >
                {formatTimeShort(ts)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function indicatorLabel(indicator: Pick<IndicatorConfig, 'type' | 'period' | 'fastPeriod' | 'slowPeriod' | 'signalPeriod'>): string {
  if (indicator.type === 'macd') {
    return `MACD ${indicator.fastPeriod ?? 12},${indicator.slowPeriod ?? 26},${indicator.signalPeriod ?? 9}`;
  }
  return `${indicator.type.toUpperCase()} ${indicator.period}`;
}

function computeIndicatorData(
  prices: { timestamp: number; open: number; high: number; low: number; close: number }[],
  indicator: IndicatorConfig,
): LineDataPoint[] {
  let base: Array<number | null>;
  if (indicator.type === 'rsi') {
    base = computeRsiValues(prices, indicator.period);
  } else if (indicator.type === 'macd') {
    const { macdLine } = computeMacdValues(
      prices,
      indicator.fastPeriod ?? 12,
      indicator.slowPeriod ?? 26,
      indicator.signalPeriod ?? 9,
    );
    base = macdLine;
  } else if (indicator.type === 'ao') {
    base = computeAoValues(prices);
  } else {
    const sourceValues = prices.map((p) => getSourcePrice(p, indicator.source));
    base = indicator.type === 'ema'
      ? computeEmaValues(sourceValues, indicator.period)
      : computeSmaValues(sourceValues, indicator.period);
  }

  return prices.map((p, i) => {
    const shiftedIndex = i - indicator.offset;
    if (shiftedIndex < 0 || shiftedIndex >= base.length) return { time: p.timestamp, value: null };
    return { time: p.timestamp, value: base[shiftedIndex] };
  });
}

function getSourcePrice(
  p: { open: number; high: number; low: number; close: number },
  source: IndicatorSource,
): number {
  if (source === 'median') return (p.high + p.low) / 2;
  if (source === 'open') return p.open;
  if (source === 'high') return p.high;
  if (source === 'low') return p.low;
  return p.close;
}

function formatTimeShort(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function computeAoValues(
  prices: { high: number; low: number }[],
): Array<number | null> {
  const medians = prices.map((p) => (p.high + p.low) / 2);
  const sma5 = computeSmaValues(medians, 5);
  const sma34 = computeSmaValues(medians, 34);
  return medians.map((_, i) => {
    const fast = sma5[i];
    const slow = sma34[i];
    if (fast == null || slow == null) return null;
    return fast - slow;
  });
}

function computeSmaValues(values: number[], period: number): Array<number | null> {
  let rolling = 0;
  return values.map((v, i) => {
    rolling += v;
    if (i >= period) rolling -= values[i - period]!;
    if (i < period - 1) return null;
    return rolling / period;
  });
}

function computeEmaValues(values: number[], period: number): Array<number | null> {
  if (values.length === 0) return [];
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;

  return values.map((v, i) => {
    if (i < period - 1) {
      seedSum += v;
      return null;
    }
    if (i === period - 1) {
      seedSum += v;
      ema = seedSum / period;
      return ema;
    }
    ema = (v - ema!) * alpha + ema!;
    return ema;
  });
}

function computeRsiValues(
  prices: { close: number }[],
  period: number,
): Array<number | null> {
  if (prices.length === 0) return [];
  const result: Array<number | null> = [null];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i].close - prices[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      result.push(null);
      continue;
    }

    if (i === period) {
      avgGain = (avgGain + gain) / period;
      avgLoss = (avgLoss + loss) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function computeMacdValues(
  prices: { close: number }[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macdLine: Array<number | null>; signalLine: Array<number | null>; histogram: Array<number | null> } {
  const closes = prices.map((p) => p.close);
  const fastEma = computeEmaValues(closes, fastPeriod);
  const slowEma = computeEmaValues(closes, slowPeriod);

  const macdLine: Array<number | null> = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f == null || s == null) return null;
    return f - s;
  });

  const macdNonNull = macdLine.filter((v): v is number => v != null);
  const signalRaw = computeEmaValues(macdNonNull, signalPeriod);

  const signalLine: Array<number | null> = [];
  let si = 0;
  for (const v of macdLine) {
    if (v == null) {
      signalLine.push(null);
    } else {
      signalLine.push(signalRaw[si] ?? null);
      si++;
    }
  }

  const histogram: Array<number | null> = macdLine.map((m, i) => {
    const s = signalLine[i];
    if (m == null || s == null) return null;
    return m - s;
  });

  return { macdLine, signalLine, histogram };
}

function computeBottomPanelData(
  prices: { timestamp: number; open: number; high: number; low: number; close: number }[],
  indicator: IndicatorConfig,
): BottomIndicatorData {
  if (indicator.type === 'rsi') {
    const values = computeRsiValues(prices, indicator.period);
    const ob = indicator.overbought ?? 70;
    const os = indicator.oversold ?? 30;
    return {
      lines: [{ label: `RSI ${indicator.period}`, color: indicator.color, values }],
      referenceLines: [
        { value: ob, color: '#ef4444aa', dashed: true },
        { value: os, color: '#22c55eaa', dashed: true },
        { value: 50, color: '#94a3b844', dashed: true },
      ],
      yRange: { min: 0, max: 100 },
    };
  }

  if (indicator.type === 'macd') {
    const fast = indicator.fastPeriod ?? 12;
    const slow = indicator.slowPeriod ?? 26;
    const signal = indicator.signalPeriod ?? 9;
    const { macdLine, signalLine, histogram } = computeMacdValues(prices, fast, slow, signal);
    return {
      lines: [
        { label: `MACD ${fast}`, color: indicator.color, values: macdLine },
        { label: `Signal ${signal}`, color: '#f59e0b', values: signalLine },
      ],
      histogram: { values: histogram, upColor: '#22c55e88', downColor: '#ef444488' },
      referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
    };
  }

  if (indicator.type === 'ao') {
    const values = computeAoValues(prices);
    return {
      lines: [{ label: 'AO', color: indicator.color, values }],
      histogram: { values, upColor: '#22c55e88', downColor: '#ef444488' },
      referenceLines: [{ value: 0, color: '#94a3b844', dashed: true }],
    };
  }

  return { lines: [] };
}

function updateData(
  prices: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[],
  mainSeries: SeriesHandle,
  volumeSeries: SeriesHandle,
  chartType: ChartType,
): void {
  if (chartType === 'line') {
    mainSeries.setData(prices.map((p) => ({ time: p.timestamp, value: p.close })));
  } else {
    mainSeries.setData(prices.map((p): OHLCV => ({
      time: p.timestamp, open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume,
    })));
  }
  volumeSeries.setData(prices.map((p): HistogramDataPoint => ({
    time: p.timestamp,
    value: p.volume,
    color: p.close >= p.open ? '#10b98155' : '#ef444455',
  })));
}
