import { useEffect, useMemo, useState } from 'react';
import { marketService } from '../../services/marketService';
import { formatDate } from '../../utils/format';
import type { MarketDataset } from '../../types';

type Props = { ticker: string };

const EVENT_TYPES = [
  'Rate Decision',
  'CPI Release',
  'NFP / Employment',
  'GDP Print',
  'PMI Data',
  'Retail Sales',
  'Trade Balance',
  'Central Bank Speech',
];

const CENTRAL_BANKS: Record<string, string> = {
  EUR: 'ECB', USD: 'Fed', GBP: 'BoE', JPY: 'BoJ', CHF: 'SNB',
  AUD: 'RBA', CAD: 'BoC', NZD: 'RBNZ',
};

export default function EarningsWidget({ ticker }: Props) {
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketService.getDataset(ticker).then((ds) => {
      if (active) setDataset(ds);
    }).catch((err) => { if (active) setError(err.message || 'Error loading data'); });
    return () => { active = false; };
  }, [ticker]);

  const currentPrice = dataset?.prices[dataset.prices.length - 1]?.close ?? 0;

  const [base, quote] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];
  const baseCB = CENTRAL_BANKS[base] ?? base;
  const quoteCB = CENTRAL_BANKS[quote] ?? quote;

  const events = useMemo(() => {
    if (!dataset) return [];

    // Generate more events from the earning dates as seeds
    const allEvents: {
      id: number;
      date: number;
      daysUntil: number;
      event: string;
      currency: string;
      centralBank: string;
      forecast: string;
      previous: string;
      impact: 'high' | 'medium' | 'low';
      impliedPips: number;
    }[] = [];

    dataset.earningsDates.forEach((date, i) => {
      // Generate 2 events per date, one for base, one for quote
      [
        { currency: base, cb: baseCB },
        { currency: quote, cb: quoteCB },
      ].forEach((side, j) => {
        const eventIdx = (i * 2 + j) % EVENT_TYPES.length;
        const daysUntil = Math.ceil((date - Date.now()) / 86400000) + j * 3;
        const isJpy = ticker.includes('JPY');
        const pipSize = isJpy ? 0.01 : 0.0001;
        const impliedPips = Math.round((30 + Math.random() * 120));

        allEvents.push({
          id: i * 10 + j,
          date: date + j * 3 * 86400000,
          daysUntil,
          event: EVENT_TYPES[eventIdx],
          currency: side.currency,
          centralBank: side.cb,
          forecast: eventIdx === 0 ? `${(2 + Math.random() * 4).toFixed(2)}%` : `${(Math.random() * 5).toFixed(1)}%`,
          previous: eventIdx === 0 ? `${(2 + Math.random() * 4).toFixed(2)}%` : `${(Math.random() * 5).toFixed(1)}%`,
          impact: eventIdx <= 2 ? 'high' : eventIdx <= 5 ? 'medium' : 'low',
          impliedPips,
        });
      });
    });

    return allEvents.sort((a, b) => a.date - b.date);
  }, [dataset, base, quote, baseCB, quoteCB, ticker]);

  const impactStyles = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    low: 'bg-gray-700/30 text-gray-500 border-gray-600/20',
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-400">{error}</span>
          </div>
        </div>
      )}
      {(!dataset) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10 backdrop-blur-sm rounded-lg">
          <span className="text-xs text-gray-400">Loading events...</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
          Economic Calendar - {ticker}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500/60" />
          <span className="text-[9px] text-gray-500">High</span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500/60 ml-1" />
          <span className="text-[9px] text-gray-500">Med</span>
          <span className="inline-block w-2 h-2 rounded-full bg-gray-500/60 ml-1" />
          <span className="text-[9px] text-gray-500">Low</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {events.map((e) => (
          <div
            key={e.id}
            className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase ${impactStyles[e.impact]}`}>
                  {e.impact}
                </span>
                <span className="text-[10px] font-bold text-cyan-400 font-mono">{e.currency}</span>
                <span className="text-xs font-medium text-white">{e.event}</span>
              </div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${e.daysUntil <= 7
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-700/50 text-gray-400'
                }`}>
                {e.daysUntil > 0 ? `${e.daysUntil}d` : 'Today'}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">{formatDate(e.date)}</span>
              <span className="text-gray-500">{e.centralBank}</span>
              <div className="flex gap-3">
                <span className="text-gray-400">Fcst: <span className="text-white font-mono">{e.forecast}</span></span>
                <span className="text-gray-400">Prev: <span className="text-gray-300 font-mono">{e.previous}</span></span>
              </div>
              <span className="text-amber-400/80 font-mono">~{e.impliedPips} pips</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
