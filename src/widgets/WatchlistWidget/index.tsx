import { useState, useMemo, useEffect } from 'react';
import { marketService } from '../../services/marketService';
import { useTickerStore } from '../../store/useTickerStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useSimulationStore } from '../../store/useSimulationStore';

type Props = { ticker: string; widgetId: string };

type WatchlistItem = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePips: number;
  changePct: number;
  decimals: number;
};

export default function WatchlistWidget({ widgetId }: Props) {
  const allPairs = useMemo(() => marketService.getAvailableTickers(), []);
  const settings = useCanvasStore((state) => state.nodes.find((node) => node.id === widgetId)?.data.settings) as Record<string, unknown> | undefined;
  const watchlist = useMemo(() => Array.isArray(settings?.watchlist) ? settings.watchlist.filter((value): value is string => typeof value === 'string') : allPairs.map((pair) => pair.ticker), [settings?.watchlist, allPairs]);
  const setWatchlist = (watchlist: string[]) => useCanvasStore.getState().updateWidgetData(widgetId, { settings: { ...settings, watchlist } });
  const [newTicker, setNewTicker] = useState('');
  const [data, setData] = useState<WatchlistItem[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const setGlobalTicker = useTickerStore((s) => s.setGlobalTicker);
  const updateWidgetData = useCanvasStore((s) => s.updateWidgetData);
  const currentIndex = useSimulationStore((s) => s.currentIndex);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      const results: WatchlistItem[] = [];
      if (active) { setError(null); setData([]); }
      for (const ticker of watchlist) {
        try {
          const ds = await marketService.getDataset(ticker);
          if (!active) return;
          const pair = allPairs.find((s) => s.ticker === ticker);
          const index = Math.min(currentIndex, ds.prices.length - 1);
          const price = ds.prices[index]?.close;
          if (!price) throw new Error(`No prices for ${ticker}`);
          const prevPrice = ds.prices[Math.max(0, index - 1)]?.close ?? price;
          const change = price - prevPrice;
          const pipSize = pair?.pipSize ?? (ticker.includes('JPY') ? 0.01 : 0.0001);
          const decimals = pipSize >= 0.1 ? 2 : pipSize >= 0.01 ? 3 : 5;
          const changePips = Math.round(change / pipSize);
          const changePct = prevPrice ? (change / prevPrice) * 100 : 0;
          results.push({ ticker, name: pair?.name ?? ticker, price, change, changePips, changePct, decimals });
          if (active) setData([...results]);
        } catch {
          if (active) setError('Some pairs are unavailable. Available prices are shown; retry to check again.');
        }
      }
      if (active) {
        setData(results);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [watchlist, currentIndex, allPairs, revision]);

  const handleSelect = (ticker: string) => {
    setGlobalTicker(ticker);
    updateWidgetData(widgetId, { ticker });
  };

  const handleAdd = () => {
    const t = newTicker.toUpperCase().trim();
    if (!allPairs.some((pair) => pair.ticker === t)) { setError('Choose a supported pair, e.g. EUR/USD.'); return; }
    if (t && !watchlist.includes(t)) {
      setWatchlist([...watchlist, t]);
    }
    setNewTicker('');
  };

  return (
    <div className="flex flex-col h-full gap-2 relative">
      {error && <div role="alert" className="nodrag text-[10px] text-amber-300">{error} <button onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
      <p className="text-[10px] text-gray-500">Yahoo daily prices; gold is a GC=F futures proxy.</p>
      {/* Add pair */}
      <div className="nodrag flex gap-1">
        <input
          type="text"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add pair (e.g. EUR/USD)..."
          className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={handleAdd}
          className="px-2 py-1 text-xs bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-600/30"
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="nodrag flex-1 overflow-y-auto space-y-0.5">
        {data.map((item) => (
          <div
            key={item.ticker}
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(item.ticker)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(item.ticker);
              }
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded hover:bg-gray-800/60 transition-colors group cursor-pointer"
          >
            <div className="text-left">
              <div className="text-xs font-bold text-white">{item.ticker}</div>
              <div className="text-[10px] text-gray-500 truncate max-w-[110px]">{item.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-white">{item.price.toFixed(item.decimals)}</div>
              <div className={`text-[10px] font-mono ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.changePips >= 0 ? '+' : ''}{item.changePips} pips ({item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%)
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWatchlist(watchlist.filter((t) => t !== item.ticker));
              }}
              className="ml-1 p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
