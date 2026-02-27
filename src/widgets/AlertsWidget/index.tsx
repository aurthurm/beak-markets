import { useState } from 'react';
import { useAlertStore } from '../../store/useAlertStore';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Alert } from '../../types';

type Props = { ticker: string };

export default function AlertsWidget({ ticker }: Props) {
  const alerts = useAlertStore((s) => s.alerts);
  const addAlert = useAlertStore((s) => s.addAlert);
  const removeAlert = useAlertStore((s) => s.removeAlert);

  const [alertType, setAlertType] = useState<Alert['type']>('price_above');
  const [alertValue, setAlertValue] = useState('');

  const filteredAlerts = alerts.filter((a) => a.ticker === ticker);

  const handleAdd = () => {
    const val = parseFloat(alertValue);
    if (isNaN(val)) return;
    addAlert({ ticker, type: alertType, value: val });
    setAlertValue('');
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Add alert form */}
      <div className="nodrag space-y-2 bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">New Alert for {ticker}</div>
        <div className="flex gap-1.5">
          <select
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as Alert['type'])}
            className="flex-1 px-2 py-1 text-xs bg-gray-700/60 border border-gray-600/40 rounded text-white focus:outline-none"
          >
            <option value="price_above">Price Above</option>
            <option value="price_below">Price Below</option>
            <option value="indicator_cross">Indicator Cross</option>
          </select>
          <input
            type="number"
            value={alertValue}
            onChange={(e) => setAlertValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Value"
            className="w-20 px-2 py-1 text-xs bg-gray-700/60 border border-gray-600/40 rounded text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            className="px-2.5 py-1 text-xs bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-600/30"
          >
            Set
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="nodrag flex-1 overflow-y-auto space-y-1">
        {filteredAlerts.length === 0 && (
          <div className="text-xs text-gray-600 text-center py-4">No alerts for {ticker}</div>
        )}
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-2.5 py-2 rounded-lg border ${alert.triggered
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-gray-800/40 border-gray-700/30'
              }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                {alert.triggered && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
                <span className="text-xs font-mono text-white">
                  {alert.type === 'price_above' ? 'Above' : alert.type === 'price_below' ? 'Below' : 'Cross'}{' '}
                  {formatCurrency(alert.value)}
                </span>
              </div>
              <div className="text-[10px] text-gray-500">{formatDate(alert.createdAt)}</div>
            </div>
            <button
              onClick={() => removeAlert(alert.id)}
              className="p-1 text-gray-600 hover:text-red-400"
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
