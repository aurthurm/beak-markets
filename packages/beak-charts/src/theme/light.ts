import type { Theme } from './types.ts';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: '#ffffff',
    text: '#334155',
    textSecondary: '#94a3b8',
    grid: '#e2e8f0',
    border: '#cbd5e1',
    crosshair: '#94a3b8',
    crosshairLabel: '#334155',
    crosshairLabelText: '#ffffff',
    candleUp: '#16a34a',
    candleDown: '#dc2626',
    wickUp: '#16a34a99',
    wickDown: '#dc262699',
    volumeUp: 'rgba(22,163,74,0.15)',
    volumeDown: 'rgba(220,38,38,0.15)',
    line: '#0891b2',
  },
  fontFamily: 'monospace',
  fontSize: 10,
};
