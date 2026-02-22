import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { marketService } from '../../services/marketService';

type Props = { ticker: string };

// Map currency to a pair where it's the base (for fetching that currency's rates)
const CURRENCY_BASE_PAIR: Record<string, string> = {
  USD: 'USD/JPY',
  EUR: 'EUR/USD',
  GBP: 'GBP/USD',
  AUD: 'AUD/USD',
  NZD: 'NZD/USD',
  // CHF, CAD, JPY: no pair has these as base in our forex list
};

function getPairForCurrency(currency: string): string | null {
  return CURRENCY_BASE_PAIR[currency] ?? null;
}

export default function InterestRatesWidget({ ticker }: Props) {
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const fin = dataset.financials;

  const [base, quote] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];
  const isPair = base && quote;

  // Base currency rates (from pair's dataset - base is always first in XXX/YYY)
  const baseRates = fin.eps;
  const baseCurrent = baseRates[baseRates.length - 1] ?? 0;

  // Quote currency rates - fetch from a pair where quote is base, if available
  const quotePair = getPairForCurrency(quote);
  const quoteDataset = useMemo(
    () => (quotePair ? marketService.getDataset(quotePair) : null),
    [quotePair]
  );
  const quoteRates = quoteDataset?.financials.eps ?? [];
  const quoteCurrent = quoteRates[quoteRates.length - 1] ?? baseRates[baseRates.length - 2] ?? 0;

  const rateDiff = isPair ? +(baseCurrent - quoteCurrent).toFixed(2) : 0;

  const chartData = useMemo(() => {
    const len = Math.max(baseRates.length, quoteRates.length);
    return Array.from({ length: len }, (_, i) => ({
      quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
      base: baseRates[i] ?? null,
      quote: quoteRates[i] ?? null,
      diff: baseRates[i] != null && quoteRates[i] != null
        ? +(baseRates[i] - quoteRates[i]).toFixed(2)
        : null,
    }));
  }, [baseRates, quoteRates]);

  const hasQuoteData = quoteRates.length > 0;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Current rates summary */}
      <div className={`grid gap-2 ${isPair ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border border-gray-700/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{base} Rate</div>
          <div className="text-lg font-bold font-mono text-cyan-400">{baseCurrent}%</div>
        </div>
        {isPair && (
          <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border border-gray-700/30">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{quote} Rate</div>
            <div className="text-lg font-bold font-mono text-amber-400">{quoteCurrent}%</div>
          </div>
        )}
      </div>

      {/* Rate differential (carry) - only for pairs */}
      {isPair && (
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Carry (Rate Diff)</span>
          <span
            className={`text-sm font-bold font-mono px-2 py-1 rounded ${
              rateDiff > 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : rateDiff < 0
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-gray-700/50 text-gray-400'
            }`}
          >
            {rateDiff > 0 ? '+' : ''}{rateDiff}%
          </span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          {rateDiff > 0 ? `Favors ${base}` : rateDiff < 0 ? `Favors ${quote}` : 'Neutral'}
        </div>
      </div>
      )}

      {/* Historical rates chart */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          Interest Rate History (%)
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} width={30} unit="%" domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: 10,
              }}
              formatter={(value: number | undefined) => [value != null ? `${value}%` : '', '']}
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="base"
              name={base}
              stroke="#22d3ee"
              strokeWidth={2}
              dot={{ r: 2, fill: '#22d3ee' }}
              connectNulls
            />
            {hasQuoteData && (
              <Line
                type="monotone"
                dataKey="quote"
                name={quote}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2, fill: '#f59e0b' }}
                connectNulls
              />
            )}
            <Legend
              wrapperStyle={{ fontSize: 9 }}
              formatter={(value) => <span className="text-gray-400">{value}</span>}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
