import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { marketService } from '../../services/marketService';
import { useSimulationStore } from '../../store/useSimulationStore';
import { formatCurrency, formatPnl } from '../../utils/format';

export default function PortfolioWidget() {
  const trades = usePortfolioStore((s) => s.trades);
  const addTrade = usePortfolioStore((s) => s.addTrade);
  const getPositions = usePortfolioStore((s) => s.getPositions);
  const currentIndex = useSimulationStore((s) => s.currentIndex);

  const [tradeTicker, setTradeTicker] = useState('EUR/USD');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [tradeQty, setTradeQty] = useState('1');
  const [tradePrice, setTradePrice] = useState('');

  const currentPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    const tickers = new Set(trades.map((t) => t.ticker));
    tickers.forEach((ticker) => {
      prices[ticker] = marketService.getLatestPrice(ticker, currentIndex);
    });
    return prices;
  }, [trades, currentIndex]);

  const positions = useMemo(() => getPositions(currentPrices), [getPositions, currentPrices]);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);

  // Equity curve mock
  const equityCurve = useMemo(() => {
    const curve = [];
    let equity = 10000;
    for (let i = 0; i < 30; i++) {
      equity += (Math.random() - 0.45) * 200 + totalPnl / 30;
      curve.push({ day: i + 1, equity: +equity.toFixed(2) });
    }
    return curve;
  }, [totalPnl]);

  const handleAddTrade = () => {
    const qty = parseInt(tradeQty);
    const price = parseFloat(tradePrice) || marketService.getLatestPrice(tradeTicker, currentIndex);
    if (!qty || qty <= 0) return;
    addTrade({ ticker: tradeTicker.toUpperCase(), side: tradeSide, quantity: qty, price });
    setTradePrice('');
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase">Portfolio Value</div>
          <div className="text-sm font-bold font-mono text-white">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase">Total P&L</div>
          <div className={`text-sm font-bold font-mono ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPnl(totalPnl)}
          </div>
        </div>
      </div>

      {/* Add trade */}
      <div className="nodrag flex gap-1 items-center">
        <input
          type="text"
          value={tradeTicker}
          onChange={(e) => setTradeTicker(e.target.value.toUpperCase())}
          className="w-20 px-1.5 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white font-mono focus:outline-none"
        />
        <select
          value={tradeSide}
          onChange={(e) => setTradeSide(e.target.value as 'buy' | 'sell')}
          className="px-1.5 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white focus:outline-none"
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <input
          type="number"
          value={tradeQty}
          onChange={(e) => setTradeQty(e.target.value)}
          placeholder="Qty"
          className="w-14 px-1.5 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white focus:outline-none"
        />
        <input
          type="number"
          value={tradePrice}
          onChange={(e) => setTradePrice(e.target.value)}
          placeholder="Mkt"
          className="w-16 px-1.5 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-600 focus:outline-none"
        />
        <button
          onClick={handleAddTrade}
          className={`px-2 py-1 text-xs rounded border ${
            tradeSide === 'buy'
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
              : 'bg-red-600/20 text-red-400 border-red-500/30'
          }`}
        >
          {tradeSide === 'buy' ? 'Buy' : 'Sell'}
        </button>
      </div>

      {/* Positions */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {positions.length === 0 && (
          <div className="text-xs text-gray-600 text-center py-3">No positions yet</div>
        )}
        {positions.map((p) => (
          <div key={p.ticker} className="flex items-center justify-between px-2 py-1.5 bg-gray-800/30 rounded border border-gray-700/20">
            <div>
              <span className="text-xs font-bold text-white">{p.ticker}</span>
              <span className="text-[10px] text-gray-500 ml-1.5">{p.quantity} lot{p.quantity !== 1 ? 's' : ''}</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-white">{formatCurrency(p.currentPrice)}</div>
              <div className={`text-[10px] font-mono ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPnl(p.pnl)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {positions.length > 0 && (
        <div className="h-20 shrink-0">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Equity Curve</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="equity" stroke="#06b6d4" fill="url(#equityGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
