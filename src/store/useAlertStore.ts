import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Alert } from '../types';

type AlertStore = {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'triggered' | 'createdAt'>) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  checkAlerts: (ticker: string, price: number) => void;
};

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],

  addAlert: (alert) => {
    set({
      alerts: [
        ...get().alerts,
        { ...alert, id: uuid(), triggered: false, createdAt: Date.now() },
      ],
    });
  },

  removeAlert: (id) => {
    set({ alerts: get().alerts.filter((a) => a.id !== id) });
  },

  triggerAlert: (id) => {
    set({
      alerts: get().alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
    });
  },

  checkAlerts: (ticker, price) => {
    const { alerts, triggerAlert } = get();
    alerts
      .filter((a) => !a.triggered && a.ticker === ticker)
      .forEach((a) => {
        if (a.type === 'price_above' && price >= a.value) triggerAlert(a.id);
        if (a.type === 'price_below' && price <= a.value) triggerAlert(a.id);
      });
  },
}));
