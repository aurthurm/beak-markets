import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import { marketService } from '../../services/marketService';
import { useSimulationStore } from '../../store/useSimulationStore';
import { aggregateCandles, type ChartTimeframe } from '../../services/chartTimeframes';
import { useCanvasStore } from '../../store/useCanvasStore';
import type { WidgetConfig } from '../../types';
import type { MarketDataset } from '../../types';

type Props = { ticker: string; data: WidgetConfig };
type Indicator = 'sma20' | 'sma50' | 'ema12' | 'rsi';

export default function ChartWidget({ ticker, data }: Props) {
  const timeframe: ChartTimeframe = data.settings.chartTimeframe === 'W' || data.settings.chartTimeframe === 'M' ? data.settings.chartTimeframe : 'D';
  const update = useCanvasStore((store) => store.updateWidgetData);
  const currentIndex = useSimulationStore((s) => s.currentIndex);
  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(new Set(Array.isArray(data.settings.chartIndicators) ? data.settings.chartIndicators as Indicator[] : ['sma20']));
  const [revision, setRevision] = useState(0);
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [history, setHistory] = useState<MarketDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  useEffect(() => {
    let active = true;
    marketService.getDataset(ticker, revision > 0).then(async (ds) => {
      const longer = timeframe === 'D' ? ds : await marketService.getDataset(ticker, revision > 0, 1000);
      if (active) { setDataset(ds); setHistory(longer); setError(null); }
    }).catch((err) => { if (active) setError(err.message || 'Error loading data'); });
    return () => { active = false; };
  }, [ticker, revision, timeframe]);

  const visiblePrices = useMemo(() => {
    if (!dataset || !history) return [];
    const cutoff = dataset.prices[Math.min(currentIndex, dataset.prices.length - 1)]?.timestamp;
    if (cutoff === undefined) return [];
    return aggregateCandles(history.prices.filter((bar) => bar.timestamp <= cutoff), timeframe);
  }, [dataset, history, currentIndex, timeframe]);
  const closes = useMemo(() => visiblePrices.map((p) => p.close), [visiblePrices]);

  const lastBar = visiblePrices[visiblePrices.length - 1];
  const prevBar = visiblePrices.length > 1 ? visiblePrices[visiblePrices.length - 2] : lastBar;
  const change = lastBar ? lastBar.close - (prevBar?.close ?? lastBar.close) : 0;
  const changePct = prevBar ? (change / prevBar.close) * 100 : 0;
  const { pipSize, decimals } = marketService.getTickerDisplayInfo(ticker);
  const changePips = Math.round(change / pipSize);

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const indicatorSeries = indicatorSeriesRef.current;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#475569', width: 1, style: 3, labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#475569', width: 1, style: 3, labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b98199',
      wickDownColor: '#ef444499',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      indicatorSeries.forEach((series) => {
        try { chart.removeSeries(series); } catch { /* Chart may already have been disposed. */ }
      });
      indicatorSeries.clear();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Update candle + volume data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData: CandlestickData[] = visiblePrices.map((bar) => ({
      time: (bar.timestamp / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    const volumeData: HistogramData[] = visiblePrices.map((bar) => ({
      time: (bar.timestamp / 1000) as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? '#10b98130' : '#ef444430',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    if (visiblePrices.length) chartRef.current?.timeScale().setVisibleLogicalRange({
      from: Math.max(0, visiblePrices.length - (timeframe === 'M' ? 60 : timeframe === 'W' ? 78 : 100)),
      to: visiblePrices.length + 2,
    });
  }, [visiblePrices, ticker, timeframe]);

  // Update indicator overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const indicatorConfigs: Record<Indicator, { color: string; calc: () => (number | null)[] }> = {
      sma20: { color: '#f59e0b', calc: () => marketService.calculateSMA(closes, 20) },
      sma50: { color: '#8b5cf6', calc: () => marketService.calculateSMA(closes, 50) },
      ema12: { color: '#06b6d4', calc: () => marketService.calculateEMA(closes, 12) },
      rsi: { color: '#a855f7', calc: () => marketService.calculateRSI(closes, 14) },
    };

    // Remove indicators that are no longer active
    indicatorSeriesRef.current.forEach((series, key) => {
      if (!activeIndicators.has(key as Indicator)) {
        try { chart.removeSeries(series); } catch { /* Chart may already have been disposed. */ }
        indicatorSeriesRef.current.delete(key);
      }
    });

    // Add/update active indicators
    activeIndicators.forEach((ind) => {
      const config = indicatorConfigs[ind];
      const values = config.calc();

      let series = indicatorSeriesRef.current.get(ind);
      if (!series) {
        if (ind === 'rsi') {
          series = chart.addSeries(LineSeries, {
            color: config.color,
            lineWidth: 1,
            priceScaleId: 'rsi',
            crosshairMarkerVisible: false,
          });
          chart.priceScale('rsi').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
          });
        } else {
          series = chart.addSeries(LineSeries, {
            color: config.color,
            lineWidth: 2,
            crosshairMarkerVisible: false,
          });
        }
        indicatorSeriesRef.current.set(ind, series);
      }

      const lineData: LineData[] = [];
      visiblePrices.forEach((bar, i) => {
        if (values[i] !== null && values[i] !== undefined) {
          lineData.push({
            time: (bar.timestamp / 1000) as Time,
            value: values[i]!,
          });
        }
      });

      series.setData(lineData);
    });
  }, [visiblePrices, closes, activeIndicators]);

  const toggleIndicator = (ind: Indicator) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full gap-2" aria-label={`${ticker} ${timeframe} price chart`}>
      <div className="nodrag flex items-center justify-between gap-2">
        <div className="flex gap-1" aria-label="Chart timeframe">{(['M', 'W', 'D'] as const).map((value) => <button key={value} aria-label={`${value === 'M' ? 'Monthly' : value === 'W' ? 'Weekly' : 'Daily'} candles`} aria-pressed={timeframe === value} onClick={() => update(data.id, { settings: { ...data.settings, chartTimeframe: value } })} className={`rounded border px-2 py-0.5 text-[10px] font-mono ${timeframe === value ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-gray-700 text-gray-500'}`}>{value === 'M' ? '1M' : value === 'W' ? '1W' : '1D'}</button>)}</div>
        <span className="font-mono text-[10px] text-gray-500">{visiblePrices.length} candles · {timeframe === 'D' ? 'DAILY' : 'AGGREGATED'}</span>
      </div>
      <p className="text-[10px] text-gray-500">{ticker === 'XAU/USD' ? 'Yahoo GC=F gold futures proxy' : 'Yahoo daily OHLC'} · {lastBar ? `Latest candle starts ${new Date(lastBar.timestamp).toISOString().slice(0, 10)}` : 'Loading prices…'} · {timeframe !== 'D' ? 'Edge periods may be incomplete. ' : ''}{ticker === 'DXY' ? 'Dollar index context.' : 'No centralized spot-FX volume.'}</p>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-400">{error}</span><button className="nodrag block mx-auto mt-2 text-cyan-300" onClick={() => setRevision((value) => value + 1)}>Retry prices</button>
          </div>
        </div>
      )}
      {/* Price header */}
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-bold text-white font-mono">
          {lastBar ? lastBar.close.toFixed(decimals) : '--'}
        </span>
        <span className={`text-sm font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {lastBar ? `${change >= 0 ? '+' : ''}${ticker === 'DXY' ? change.toFixed(2) + ' points' : changePips + ' pips'} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)` : 'Loading…'}
        </span>
      </div>

      {/* Indicator toggles */}
      <div className="nodrag flex gap-1.5 flex-wrap">
        {(['sma20', 'sma50', 'ema12', 'rsi'] as Indicator[]).map((ind) => (
          <button
            key={ind}
            onClick={() => toggleIndicator(ind)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border ${activeIndicators.has(ind)
                ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
          >
            {ind.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="nodrag flex-1 min-h-0" />
    </div>
  );
}
