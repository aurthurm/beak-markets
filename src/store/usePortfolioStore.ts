import { positionsFromTrades } from '../services/portfolioMath';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { Trade, PortfolioPosition } from '../types';

type PortfolioStore = {
  trades: Trade[];
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp'>) => void;
  removeTrade: (id: string) => void;
  getPositions: (currentPrices: Record<string, number>) => PortfolioPosition[];
};

export const usePortfolioStore = create<PortfolioStore>()(persist((set, get) => ({
  trades: [],

  addTrade: (trade) => {
    if (!Number.isFinite(trade.quantity) || trade.quantity <= 0 || !Number.isFinite(trade.price) || trade.price <= 0) return;
    set({
      trades: [...get().trades, { ...trade, id: uuid(), timestamp: Date.now() }],
    });
  },

  removeTrade: (id) => {
    set({ trades: get().trades.filter((t) => t.id !== id) });
  },

  getPositions: (currentPrices) => {
    return positionsFromTrades(get().trades, currentPrices);
  },
}), { name: 'canvas-trader-paper-ledger', partialize: (state) => ({ trades: state.trades }) }));
