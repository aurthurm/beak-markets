import { create } from 'zustand';

type TickerStore = {
  globalTicker: string;
  setGlobalTicker: (ticker: string) => void;
};

export const useTickerStore = create<TickerStore>((set) => ({
  globalTicker: 'EUR/USD',
  setGlobalTicker: (ticker) => set({ globalTicker: ticker }),
}));
