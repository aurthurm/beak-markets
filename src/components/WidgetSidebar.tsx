import { useCanvasStore } from '../store/useCanvasStore';
import type { WidgetType } from '../types';
import { WIDGET_DEFAULTS } from '../types';

const widgetTypes: WidgetType[] = ['briefing', 'chart', 'beakchart', 'watchlist', 'financials', 'valuation', 'interestRates', 'alerts', 'portfolio', 'earnings', 'news', 'sentiment', 'ainews', 'cot', 'yields', 'youtube', 'sticker', 'macroboard', 'liquidity', 'scenario'];

const WIDGET_ICONS: Record<WidgetType, React.ReactNode> = {
  briefing: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h4M16 14v5M14 16h4" /></svg>,
  macroboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20V4h18v16H3Z M3 9h18 M9 9v11 M15 9v11" /></svg>,
  liquidity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 7h20M2 17h20M3 12l5-8 5 16 8-8" /></svg>,
  scenario: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v18M5 12h7l7-7M12 12l7 7M15 5h4v4M15 19h4v-4" /></svg>,
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-7" />
    </svg>
  ),
  beakchart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="6" y="8" width="3" height="8" rx="0.5" />
      <rect x="11" y="5" width="3" height="11" rx="0.5" />
      <rect x="16" y="10" width="3" height="6" rx="0.5" />
    </svg>
  ),
  watchlist: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  financials: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  valuation: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-3 3" />
    </svg>
  ),
  interestRates: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  alerts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  portfolio: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  earnings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  news: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  ),
  sentiment: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  cot: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" />
      <path d="M12 16v-8" />
      <path d="M17 16V8" />
      <path d="M3 12h18" />
    </svg>
  ),
  ainews: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  yields: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 12h2l2 4 2-8 2 4h2" />
    </svg>
  ),
  youtube: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  sticker: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </svg>
  ),
};

import { WIDGET_DRAG_DATA_KEY } from '../constants';

export default function WidgetSidebar() {
  const addWidget = useCanvasStore((s) => s.addWidget);
  const addResearchPresets = useCanvasStore((s) => s.addResearchPresets);
  const addEurusdDesk = useCanvasStore((s) => s.addEurusdDesk);
  const addResearchDesk = useCanvasStore((s) => s.addResearchDesk);

  const handleDragStart = (e: React.DragEvent, type: WidgetType) => {
    e.dataTransfer.setData(WIDGET_DRAG_DATA_KEY, type);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', type); // fallback for some browsers

    // Custom drag image so it's not blank
    const label = WIDGET_DEFAULTS[type]?.label ?? type;
    const dragEl = document.createElement('div');
    Object.assign(dragEl.style, {
      position: 'absolute',
      top: '-9999px',
      left: '-9999px',
      padding: '8px 12px',
      background: '#1e293b',
      border: '1px solid rgba(6, 182, 212, 0.5)',
      borderRadius: '8px',
      color: '#22d3ee',
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    });
    dragEl.textContent = label;
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 24, 16);
    requestAnimationFrame(() => dragEl.remove());
  };

  const handleClick = (type: WidgetType) => {
    addWidget(type);
  };

  return (
    <div data-widget-sidebar className="fixed left-4 top-1/2 -translate-y-1/2 z-40 grid grid-cols-2 gap-1 py-3 px-2 max-h-[80vh] overflow-y-auto bg-gray-900/90 backdrop-blur-xl border border-gray-700/60 rounded-xl shadow-2xl shadow-black/40">
      <button onClick={addEurusdDesk} className="col-span-2 text-[10px] text-amber-200 border border-amber-400/40 bg-amber-400/5 rounded py-2" title="Open the EUR/USD multi-timeframe example">EUR/USD desk</button>
      <button onClick={addResearchDesk} className="col-span-2 text-[10px] text-cyan-300 border border-cyan-500/30 rounded py-2" title="Create a macro research dashboard">Research desk</button>
      <button onClick={addResearchPresets} className="col-span-2 text-[10px] text-cyan-300 border border-cyan-500/30 rounded py-2" title="Add three research dashboard presets">3 presets</button>
      {widgetTypes.map((type) => (
        <button type="button" aria-label={`Add ${WIDGET_DEFAULTS[type].label}`}
          key={type}
          draggable
          onDragStart={(e) => handleDragStart(e, type)}
          onClick={() => handleClick(type)}
          title={`${WIDGET_DEFAULTS[type].label} — drag to canvas or click to add`}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-200 cursor-grab active:cursor-grabbing [&_svg]:shrink-0"
        >
          {WIDGET_ICONS[type]}
        </button>
      ))}
    </div>
  );
}
