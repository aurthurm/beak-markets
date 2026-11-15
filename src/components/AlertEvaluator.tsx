import { useEffect } from 'react';
import { useAlertStore } from '../store/useAlertStore';
import { useSimulationStore } from '../store/useSimulationStore';
import { marketService } from '../services/marketService';

// Evaluate all saved pairs even when their alert widgets are on another dashboard.
export default function AlertEvaluator() {
  const symbols = useAlertStore((state) => [...new Set(state.alerts.filter((alert) => !alert.triggered).map((alert) => alert.ticker))].sort().join('|'));
  const currentIndex = useSimulationStore((state) => state.currentIndex);
  useEffect(() => {
    let active = true;
    const check = async () => {
      await Promise.allSettled(symbols.split('|').filter(Boolean).map(async (ticker) => {
        const price = await marketService.getLatestPrice(ticker, currentIndex);
        if (active) useAlertStore.getState().checkAlerts(ticker, price);
      }));
    };
    void check();
    const timer = window.setInterval(check, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [symbols, currentIndex]);
  return null;
}
