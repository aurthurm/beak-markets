import { useRef, useState, useCallback, useEffect } from 'react';
import type { DrawingToolType } from '@beak/charts';

type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right' | 'free';
type InteractionMode = 'select' | DrawingToolType | null;
export type NavigationTool = 'select' | 'hand' | 'crosshair';

type Props = {
  activeMode: InteractionMode;
  activeNavigationTool: NavigationTool;
  selectedDrawingId: string | null;
  onChangeMode: (mode: InteractionMode) => void;
  onChangeNavigationTool: (tool: NavigationTool) => void;
  onDeleteSelected: () => void;
};

const TOOLS: { type: DrawingToolType; title: string; icon: React.ReactNode }[] = [
  {
    type: 'horizontalLine',
    title: 'Horizontal Line',
    icon: <HLineIcon />,
  },
  {
    type: 'trendLine',
    title: 'Trend Line',
    icon: <TrendLineIcon />,
  },
  {
    type: 'box',
    title: 'Box / Rectangle',
    icon: <BoxIcon />,
  },
  {
    type: 'arrow',
    title: 'Arrow',
    icon: <ArrowIcon />,
  },
  {
    type: 'arrowUp',
    title: 'Arrow Up',
    icon: <ArrowUpIcon />,
  },
  {
    type: 'arrowDown',
    title: 'Arrow Down',
    icon: <ArrowDownIcon />,
  },
];

export function DrawingToolbar({
  activeMode,
  activeNavigationTool,
  selectedDrawingId,
  onChangeMode,
  onChangeNavigationTool,
  onDeleteSelected,
}: Props) {
  const [position, setPosition] = useState<ToolbarPosition>('top');
  const [freePos, setFreePos] = useState({ x: 8, y: 8 });
  const [showDrawMenu, setShowDrawMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showDock, setShowDock] = useState(false);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (toolbarRef.current) {
      parentRef.current = toolbarRef.current.offsetParent as HTMLElement;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only start drag from the grip handle
    if (!(e.target as HTMLElement).closest('[data-grip]')) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;

    const rect = toolbarRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current || !parentRef.current) return;
      const parentRect = parentRef.current.getBoundingClientRect();
      const x = ev.clientX - parentRect.left - dragOffset.current.x;
      const y = ev.clientY - parentRect.top - dragOffset.current.y;
      setPosition('free');
      setFreePos({
        x: Math.max(0, Math.min(x, parentRect.width - 40)),
        y: Math.max(0, Math.min(y, parentRect.height - 40)),
      });
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const isVertical = position === 'left' || position === 'right';
  const tooltipSide = getTooltipSide(position);
  const positionStyles = getPositionStyle(position, freePos);

  const clearCloseTimer = useCallback(() => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    hoverCloseTimer.current = setTimeout(() => {
      setShowDrawMenu(false);
      setShowEditMenu(false);
      setShowDock(false);
      hoverCloseTimer.current = null;
    }, 150);
  }, [clearCloseTimer]);

  const openDrawMenu = useCallback(() => {
    clearCloseTimer();
    setShowEditMenu(false);
    setShowDock(false);
    setShowDrawMenu(true);
  }, [clearCloseTimer]);

  const openEditMenu = useCallback(() => {
    clearCloseTimer();
    setShowDrawMenu(false);
    setShowDock(false);
    setShowEditMenu(true);
  }, [clearCloseTimer]);

  const openDockMenu = useCallback(() => {
    clearCloseTimer();
    setShowDrawMenu(false);
    setShowEditMenu(false);
    setShowDock(true);
  }, [clearCloseTimer]);

  return (
    <div
      ref={toolbarRef}
      onPointerDown={onPointerDown}
      className="nodrag absolute z-10 flex items-center gap-px"
      style={{
        ...positionStyles,
        flexDirection: isVertical ? 'column' : 'row',
      }}
    >
      {/* Glass container */}
      <div
        className="flex items-center gap-px rounded-lg border border-gray-700/60 bg-gray-900/85 backdrop-blur-md shadow-lg shadow-black/30 p-0.5"
        style={{ flexDirection: isVertical ? 'column' : 'row' }}
      >
        {/* Drag grip */}
        <Tooltip title="Drag to reposition" side={tooltipSide}>
          <div
            data-grip
            className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 px-1"
          >
            <GripIcon vertical={isVertical} />
          </div>
        </Tooltip>

        {/* Separator */}
        {isVertical
          ? <div className="w-5 h-px bg-gray-700/50 mx-auto" />
          : <div className="w-px h-5 bg-gray-700/50" />
        }

        {/* Drawing tools dropdown */}
        <div
          className="relative"
          onPointerEnter={openDrawMenu}
          onPointerLeave={scheduleClose}
        >
          <button
            className={`flex items-center justify-center w-8 h-7 rounded transition-all gap-px ${
              activeMode === 'horizontalLine' ||
              activeMode === 'trendLine' ||
              activeMode === 'box' ||
              activeMode === 'arrow' ||
              activeMode === 'arrowUp' ||
              activeMode === 'arrowDown'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40'
            }`}
          >
            <DrawPanelIcon />
            <ChevronIcon direction={isVertical ? (position === 'left' ? 'right' : 'left') : position === 'bottom' ? 'up' : 'down'} />
          </button>
          {showDrawMenu && (
            <DrawToolsMenu
              tools={TOOLS}
              activeMode={activeMode}
              toolbarPosition={position}
              onChange={(type) => {
                onChangeNavigationTool('select');
                onChangeMode(activeMode === type ? null : type);
                setShowDrawMenu(false);
              }}
              onClose={() => setShowDrawMenu(false)}
            />
          )}
        </div>

        {/* Edit tools dropdown */}
        <div
          className="relative"
          onPointerEnter={openEditMenu}
          onPointerLeave={scheduleClose}
        >
          <button
            className={`flex items-center justify-center w-8 h-7 rounded transition-all gap-px ${
              activeMode === 'select' || activeNavigationTool === 'hand' || activeNavigationTool === 'crosshair'
                ? 'text-cyan-400 bg-cyan-500/15'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40'
            }`}
          >
            <EditPanelIcon />
            <ChevronIcon direction={isVertical ? (position === 'left' ? 'right' : 'left') : position === 'bottom' ? 'up' : 'down'} />
          </button>
          {showEditMenu && (
            <EditToolsMenu
              activeMode={activeMode}
              activeNavigationTool={activeNavigationTool}
              selectedDrawingId={selectedDrawingId}
              toolbarPosition={position}
              onChangeMode={onChangeMode}
              onChangeNavigationTool={onChangeNavigationTool}
              onDeleteSelected={onDeleteSelected}
              onClose={() => setShowEditMenu(false)}
            />
          )}
        </div>

        {/* Separator */}
        {isVertical
          ? <div className="w-5 h-px bg-gray-700/50 mx-auto" />
          : <div className="w-px h-5 bg-gray-700/50" />
        }

        {/* Dock position dropdown */}
        <div
          className="relative"
          onPointerEnter={openDockMenu}
          onPointerLeave={scheduleClose}
        >
          <button
            className="flex items-center justify-center w-8 h-7 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700/40 transition-all gap-px"
          >
            <DockIcon />
            <ChevronIcon direction={isVertical ? (position === 'left' ? 'right' : 'left') : position === 'bottom' ? 'up' : 'down'} />
          </button>
          {showDock && (
            <DockMenu
              current={position}
              toolbarPosition={position}
              onChange={(p) => {
                setPosition(p);
                setShowDock(false);
                if (p !== 'free') setFreePos({ x: 8, y: 8 });
              }}
              onClose={() => setShowDock(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip (opens away from toolbar edge) ──

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

function getTooltipSide(toolbarPosition: ToolbarPosition): TooltipSide {
  switch (toolbarPosition) {
    case 'top': return 'bottom';
    case 'bottom': return 'top';
    case 'left': return 'right';
    case 'right': return 'left';
    case 'free': return 'bottom';
    default: return 'bottom';
  }
}

function Tooltip({ children, title, side }: {
  children: React.ReactNode;
  title: string;
  side: TooltipSide;
}) {
  const [visible, setVisible] = useState(false);

  const style: React.CSSProperties = (() => {
    const gap = 4;
    const base = {
      position: 'absolute' as const,
      zIndex: 60,
      padding: '4px 8px',
      fontSize: 10,
      whiteSpace: 'nowrap' as const,
      borderRadius: 4,
      pointerEvents: 'none' as const,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      color: '#e2e8f0',
      border: '1px solid rgba(71, 85, 105, 0.6)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    };
    switch (side) {
      case 'bottom': return { ...base, top: '100%', marginTop: gap, left: '50%', transform: 'translateX(-50%)' };
      case 'top': return { ...base, bottom: '100%', marginBottom: gap, left: '50%', transform: 'translateX(-50%)' };
      case 'right': return { ...base, left: '100%', marginLeft: gap, top: '50%', transform: 'translateY(-50%)' };
      case 'left': return { ...base, right: '100%', marginRight: gap, top: '50%', transform: 'translateY(-50%)' };
      default: return base;
    }
  })();

  return (
    <div
      className="relative"
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => setVisible(false)}
    >
      {children}
      {visible && title && (
        <div role="tooltip" style={style}>
          {title}
        </div>
      )}
    </div>
  );
}

// ── Drawing tools menu ──

function DrawToolsMenu({
  tools,
  activeMode,
  toolbarPosition,
  onChange,
  onClose,
}: {
  tools: typeof TOOLS;
  activeMode: InteractionMode;
  toolbarPosition: ToolbarPosition;
  onChange: (type: DrawingToolType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 p-1 rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur-md shadow-xl shadow-black/40"
      style={getDockMenuStyle(toolbarPosition)}
    >
      <div className="flex flex-col gap-0.5 min-w-[120px]">
        {tools.map(({ type, title, icon }) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-all ${
              activeMode === type
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
            }`}
          >
            {icon}
            <span>{title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Edit tools menu ──

const EDIT_TOOLS: { id: NavigationTool; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select', icon: <SelectIcon /> },
  { id: 'hand', label: 'Hand pan', icon: <HandIcon /> },
  { id: 'crosshair', label: 'Crosshair', icon: <CrosshairIcon /> },
];

function EditToolsMenu({
  activeMode,
  activeNavigationTool,
  selectedDrawingId,
  toolbarPosition,
  onChangeMode,
  onChangeNavigationTool,
  onDeleteSelected,
  onClose,
}: {
  activeMode: InteractionMode;
  activeNavigationTool: NavigationTool;
  selectedDrawingId: string | null;
  toolbarPosition: ToolbarPosition;
  onChangeMode: (mode: InteractionMode) => void;
  onChangeNavigationTool: (tool: NavigationTool) => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onClose]);

  const isActive = (id: NavigationTool) =>
    (id === 'select' && activeMode === 'select') ||
    (id === 'hand' && activeNavigationTool === 'hand') ||
    (id === 'crosshair' && activeNavigationTool === 'crosshair');

  return (
    <div
      ref={ref}
      className="absolute z-50 p-1 rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur-md shadow-xl shadow-black/40"
      style={getDockMenuStyle(toolbarPosition)}
    >
      <div className="flex flex-col gap-0.5 min-w-[120px]">
        {EDIT_TOOLS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => {
              if (id === 'select') {
                onChangeMode('select');
                onChangeNavigationTool('select');
              } else {
                onChangeMode(null);
                onChangeNavigationTool(id);
              }
              onClose();
            }}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-all ${
              isActive(id)
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
        <div className="my-0.5 h-px bg-gray-700/50" />
        <button
          onClick={() => {
            onDeleteSelected();
            onClose();
          }}
          disabled={!selectedDrawingId}
          className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-all ${
            selectedDrawingId
              ? 'text-rose-300 hover:text-rose-200 hover:bg-rose-500/15'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <TrashIcon />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

// ── Dock position menu ──

/** Menu opens away from toolbar edge: top→down, bottom→up, left→right, right→left */
function getDockMenuStyle(toolbarPosition: ToolbarPosition): React.CSSProperties {
  const gap = 4;
  switch (toolbarPosition) {
    case 'top':
      return { top: '100%', marginTop: gap, left: 0, right: 'auto' };
    case 'bottom':
      return { bottom: '100%', marginBottom: gap, left: 0, right: 'auto' };
    case 'left':
      return { left: '100%', marginLeft: gap, top: 0, bottom: 'auto' };
    case 'right':
      return { right: '100%', marginRight: gap, left: 'auto', top: 0, bottom: 'auto' };
    case 'free':
      return { top: '100%', marginTop: gap, left: 0, right: 'auto' };
    default:
      return { top: '100%', marginTop: gap, left: 0, right: 'auto' };
  }
}

function DockMenu({ current, toolbarPosition, onChange, onClose }: {
  current: ToolbarPosition;
  toolbarPosition: ToolbarPosition;
  onChange: (p: ToolbarPosition) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onClose]);

  const options: { pos: ToolbarPosition; label: string; icon: React.ReactNode }[] = [
    { pos: 'top', label: 'Top', icon: <DockPositionIcon dir="top" /> },
    { pos: 'bottom', label: 'Bottom', icon: <DockPositionIcon dir="bottom" /> },
    { pos: 'left', label: 'Left', icon: <DockPositionIcon dir="left" /> },
    { pos: 'right', label: 'Right', icon: <DockPositionIcon dir="right" /> },
  ];

  return (
    <div
      ref={ref}
      className="absolute z-50 p-1 rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur-md shadow-xl shadow-black/40"
      style={getDockMenuStyle(toolbarPosition)}
    >
      <div className="flex flex-col gap-0.5 min-w-[90px]">
        {options.map(({ pos, label, icon }) => (
          <button
            key={pos}
            onClick={() => onChange(pos)}
            className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-all ${
              current === pos
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Position styles ──

function getPositionStyle(
  position: ToolbarPosition,
  freePos: { x: number; y: number },
): React.CSSProperties {
  switch (position) {
    case 'top':
      return { top: 6, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom':
      return { bottom: 6, left: '50%', transform: 'translateX(-50%)' };
    case 'left':
      return { left: 6, top: '50%', transform: 'translateY(-50%)' };
    case 'right':
      return { right: 6, top: '50%', transform: 'translateY(-50%)' };
    case 'free':
      return { left: freePos.x, top: freePos.y };
  }
}

// ── SVG Icons ──

function HLineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="1" y1="8" x2="15" y2="8" strokeDasharray="3 2" />
      <circle cx="2" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrendLineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="13" x2="14" y2="3" />
      <circle cx="2" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14" cy="3" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="3" width="12" height="10" rx="0.8" fill="currentColor" opacity="0.08" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="12.5" x2="12.5" y2="3" />
      <path d="M10 3h2.5v2.5" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2.5L2.5 11h11L8 2.5z" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 13.5L13.5 5h-11L8 13.5z" />
    </svg>
  );
}

function DrawPanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="2" y1="13" x2="14" y2="3" />
      <circle cx="2" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14" cy="3" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EditPanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8l2 2 4-4" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v12l3.8-3.1 2.6 2.4 1.6-1.7-2.6-2.4L12 8 3 2z" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-16 0v-2a2 2 0 1 1 4 0V8" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M3 4h10" />
      <path d="M5 4V2.8h6V4" />
      <rect x="4.2" y="4" width="7.6" height="9.5" rx="1.1" />
      <line x1="6.5" y1="6.2" x2="6.5" y2="11.8" />
      <line x1="9.5" y1="6.2" x2="9.5" y2="11.8" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'down' | 'up' | 'left' | 'right' }) {
  const size = 8;
  const rot = direction === 'down' ? 0 : direction === 'up' ? 180 : direction === 'right' ? -90 : 90;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rot}deg)`, opacity: 0.7 }}
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

function GripIcon({ vertical }: { vertical: boolean }) {
  if (vertical) {
    return (
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="3" cy="3" r="1" /><circle cx="7" cy="3" r="1" />
        <circle cx="3" cy="7" r="1" /><circle cx="7" cy="7" r="1" />
        <circle cx="3" cy="11" r="1" /><circle cx="7" cy="11" r="1" />
      </svg>
    );
  }
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
      <circle cx="3" cy="3" r="1" /><circle cx="3" cy="7" r="1" />
      <circle cx="7" cy="3" r="1" /><circle cx="7" cy="7" r="1" />
      <circle cx="11" cy="3" r="1" /><circle cx="11" cy="7" r="1" />
    </svg>
  );
}

function DockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <line x1="1" y1="5" x2="15" y2="5" />
    </svg>
  );
}

function DockPositionIcon({ dir }: { dir: 'top' | 'bottom' | 'left' | 'right' }) {
  const base = "w-3.5 h-3.5";
  return (
    <svg className={base} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="1" y="1" width="12" height="12" rx="1.5" />
      {dir === 'top' && <line x1="4" y1="3.5" x2="10" y2="3.5" strokeWidth="2" className="text-cyan-400" stroke="currentColor" />}
      {dir === 'bottom' && <line x1="4" y1="10.5" x2="10" y2="10.5" strokeWidth="2" className="text-cyan-400" stroke="currentColor" />}
      {dir === 'left' && <line x1="3.5" y1="4" x2="3.5" y2="10" strokeWidth="2" className="text-cyan-400" stroke="currentColor" />}
      {dir === 'right' && <line x1="10.5" y1="4" x2="10.5" y2="10" strokeWidth="2" className="text-cyan-400" stroke="currentColor" />}
    </svg>
  );
}
