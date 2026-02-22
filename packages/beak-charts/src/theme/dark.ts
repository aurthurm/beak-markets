import type { Theme } from './types.ts';

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background: '#0f1117',
    text: '#94a3b8',
    textSecondary: '#475569',
    grid: '#1e293b',
    border: '#1e293b',
    crosshair: '#475569',
    crosshairLabel: '#1e293b',
    crosshairLabelText: '#e2e8f0',
    candleUp: '#10b981',
    candleDown: '#ef4444',
    wickUp: '#10b98199',
    wickDown: '#ef444499',
    volumeUp: 'rgba(16,185,129,0.2)',
    volumeDown: 'rgba(239,68,68,0.2)',
    line: '#06b6d4',
  },
  fontFamily: 'monospace',
  fontSize: 10,
};
