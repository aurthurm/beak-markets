import { useMemo } from 'react';
import { marketService } from '../../services/marketService';
import { useSimulationStore } from '../../store/useSimulationStore';

type Props = { ticker: string };

export default function ValuationWidget({ ticker }: Props) {
  const currentIndex = useSimulationStore((s) => s.currentIndex);
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const fin = dataset.financials;
  const currentPrice = dataset.prices[currentIndex]?.close ?? 0;

  const [base, quote] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];

  // Forex-relevant metrics: rate diff, GDP diff, CPI diff, trade balance
  const baseRate = fin.eps[fin.eps.length - 1] ?? 3.0;
  const quoteRate = fin.eps[fin.eps.length - 2] ?? 2.5;
  const rateDiff = +(baseRate - quoteRate).toFixed(2);

  const metrics = useMemo(
    () => [
      {
        label: 'Rate Differential',
        value: `${rateDiff > 0 ? '+' : ''}${rateDiff}%`,
        detail: `${base} ${baseRate}% vs ${quote} ${quoteRate}%`,
        gauge: Math.abs(rateDiff) / 5,
        rating: rateDiff > 1 ? `Favors ${base}` : rateDiff < -1 ? `Favors ${quote}` : 'Neutral',
        color: rateDiff > 1 ? 'text-emerald-400' : rateDiff < -1 ? 'text-red-400' : 'text-amber-400',
      },
      {
        label: 'Inflation (CPI)',
        value: `${fin.margins}%`,
        detail: `${base} economy`,
        gauge: Math.min(Math.abs(fin.margins) / 6, 1),
        rating: fin.margins < 2 ? 'Low' : fin.margins < 3.5 ? 'On Target' : 'Elevated',
        color: fin.margins < 2 ? 'text-cyan-400' : fin.margins < 3.5 ? 'text-emerald-400' : 'text-red-400',
      },
      {
        label: 'Unemployment',
        value: `${fin.peRatio}%`,
        detail: `${base} labor market`,
        gauge: Math.min(fin.peRatio / 10, 1),
        rating: fin.peRatio < 4 ? 'Tight' : fin.peRatio < 6 ? 'Moderate' : 'Weak',
        color: fin.peRatio < 4 ? 'text-emerald-400' : fin.peRatio < 6 ? 'text-amber-400' : 'text-red-400',
      },
      {
        label: 'Trade Balance',
        value: `${fin.pegRatio > 0 ? '+' : ''}${fin.pegRatio}B`,
        detail: `${base} current account`,
        gauge: Math.min(Math.abs(fin.pegRatio) / 4, 1),
        rating: fin.pegRatio > 0 ? 'Surplus' : 'Deficit',
        color: fin.pegRatio > 0 ? 'text-emerald-400' : 'text-red-400',
      },
    ],
    [fin, base, quote, baseRate, quoteRate, rateDiff]
  );

  // Pip calculation
  const isJpy = ticker.includes('JPY');
  const pipSize = isJpy ? 0.01 : 0.0001;
  const dailyRange = dataset.prices[currentIndex]
    ? dataset.prices[currentIndex].high - dataset.prices[currentIndex].low
    : 0;
  const dailyPips = Math.round(dailyRange / pipSize);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Spot rate header */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Spot Rate</span>
          <span className="text-[10px] text-gray-500 font-mono">Daily Range: {dailyPips} pips</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold font-mono text-white">{currentPrice.toFixed(isJpy ? 3 : 5)}</div>
          <div className={`text-xs font-mono px-2 py-1 rounded ${rateDiff > 0 ? 'bg-emerald-500/10 text-emerald-400' : rateDiff < 0 ? 'bg-red-500/10 text-red-400' : 'bg-gray-700/50 text-gray-400'}`}>
            Carry: {rateDiff > 0 ? '+' : ''}{rateDiff}%
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex-1 space-y-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between items-baseline">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</span>
                <span className="text-[9px] text-gray-600 ml-1.5">{m.detail}</span>
              </div>
              <span className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                style={{ width: `${Math.min(m.gauge, 1) * 100}%` }}
              />
            </div>
            <div className={`text-[10px] ${m.color}`}>{m.rating}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
