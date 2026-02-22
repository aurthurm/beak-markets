import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { marketService } from '../../services/marketService';

type Props = { ticker: string };

export default function FinancialsWidget({ ticker }: Props) {
  const dataset = useMemo(() => marketService.getDataset(ticker), [ticker]);
  const fin = dataset.financials;

  // For forex: revenue = GDP growth %, eps = interest rates %
  const gdpData = useMemo(
    () =>
      fin.revenue.map((val, i) => ({
        quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
        gdp: val,
      })),
    [fin.revenue]
  );

  const rateData = useMemo(
    () =>
      fin.eps.map((val, i) => ({
        quarter: `Q${(i % 4) + 1} '${Math.floor(23 + i / 4)}`,
        rate: val,
      })),
    [fin.eps]
  );

  // Extract base/quote from pair like "EUR/USD"
  const [base, quote] = ticker.includes('/') ? ticker.split('/') : [ticker, ''];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Key macro metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Debt-to-GDP" value={`${fin.debt}%`} positive={fin.debt < 60} />
        <MetricCard label="CPI (Inflation)" value={`${fin.margins}%`} positive={fin.margins > 0 && fin.margins < 3} />
        <MetricCard label="Unemployment" value={`${fin.peRatio}%`} positive={fin.peRatio < 5} />
        <MetricCard label="Trade Balance" value={`${fin.pegRatio > 0 ? '+' : ''}${fin.pegRatio}B`} positive={fin.pegRatio > 0} />
      </div>

      {/* GDP Growth chart */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
          {base} GDP Growth (%)
        </div>
        <ResponsiveContainer width="100%" height="45%">
          <BarChart data={gdpData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} width={30} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: 10 }}
              formatter={(value: any) => [`${value}%`, 'GDP Growth']}
            />
            <Bar dataKey="gdp" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Interest Rate chart */}
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 mt-2">
          {base} Interest Rate (%)
        </div>
        <ResponsiveContainer width="100%" height="45%">
          <BarChart data={rateData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} width={30} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: 10 }}
              formatter={(value: any) => [`${value}%`, 'Rate']}
            />
            <Bar dataKey="rate" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
