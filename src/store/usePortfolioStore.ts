import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Trade, PortfolioPosition } from '../types';

type PortfolioStore = {
  trades: Trade[];
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp'>) => void;
  removeTrade: (id: string) => void;
  getPositions: (currentPrices: Record<string, number>) => PortfolioPosition[];
};

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  trades: [],

  addTrade: (trade) => {
    set({
      trades: [...get().trades, { ...trade, id: uuid(), timestamp: Date.now() }],
    });
  },

  removeTrade: (id) => {
    set({ trades: get().trades.filter((t) => t.id !== id) });
  },

  getPositions: (currentPrices) => {
    const { trades } = get();
    const map = new Map<string, { qty: number; cost: number }>();

    trades.forEach((t) => {
      const existing = map.get(t.ticker) ?? { qty: 0, cost: 0 };
      if (t.side === 'buy') {
        existing.qty += t.quantity;
        existing.cost += t.quantity * t.price;
      } else {
        existing.qty -= t.quantity;
        existing.cost -= t.quantity * t.price;
      }
      map.set(t.ticker, existing);
    });

    const positions: PortfolioPosition[] = [];
    map.forEach((val, ticker) => {
      if (val.qty !== 0) {
        const currentPrice = currentPrices[ticker] ?? 0;
        const avgPrice = val.cost / val.qty;
        positions.push({
          ticker,
          quantity: val.qty,
          avgPrice: +avgPrice.toFixed(2),
          currentPrice,
          pnl: +((currentPrice - avgPrice) * val.qty).toFixed(2),
        });
      }
    });

    return positions;
  },
}));
