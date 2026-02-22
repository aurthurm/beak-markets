import { memo, type ReactNode, useState, useCallback, useEffect } from 'react';
import {
  NodeResizeControl,
  ResizeControlVariant,
  type ControlPosition,
  type ResizeParamsWithDirection,
} from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTickerStore } from '../store/useTickerStore';
import type { WidgetConfig } from '../types';
import { WIDGET_DEFAULTS } from '../types';
import { captureWidget, downloadImage } from '../utils/capture';
import type { ResizeGuide } from '../store/useCanvasStore';

type Props = {
  data: WidgetConfig;
  children: ReactNode;
  selected?: boolean;
};

const RESIZE_SNAP_THRESHOLD = 10;
const RESIZE_HANDLE_POSITIONS: ControlPosition[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

function WidgetContainerInner({ data, children, selected = false }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const nodes = useCanvasStore((s) => s.nodes);
  const removeWidget = useCanvasStore((s) => s.removeWidget);
  const duplicateWidget = useCanvasStore((s) => s.duplicateWidget);
  const updateWidgetData = useCanvasStore((s) => s.updateWidgetData);
  const setResizeGuides = useCanvasStore((s) => s.setResizeGuides);
  const clearResizeGuides = useCanvasStore((s) => s.clearResizeGuides);
  const setGlobalTicker = useTickerStore((s) => s.setGlobalTicker);

  const [localTicker, setLocalTicker] = useState(data.ticker);

  const handleTickerSubmit = useCallback(() => {
    const t = localTicker.toUpperCase().trim();
    if (!t) return;
    updateWidgetData(data.id, { ticker: t });
    if (data.syncTicker) {
      setGlobalTicker(t);
    }
  }, [localTicker, data.id, data.syncTicker, updateWidgetData, setGlobalTicker]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleTickerSubmit();
    },
    [handleTickerSubmit]
  );

  const label = WIDGET_DEFAULTS[data.type]?.label ?? data.type;
  const description = WIDGET_DEFAULTS[data.type]?.description ?? '';
  const isLocked = data.locked ?? false;

  const showResizeHandles = !isLocked && (isHovered || selected);
  const isSticker = data.type === 'sticker';
  const minWidth = isSticker ? 180 : 280;

  useEffect(() => () => clearResizeGuides(), [clearResizeGuides]);

  const updateResizeGuides = useCallback((params: ResizeParamsWithDirection) => {
    const moving = {
      left: params.x,
      right: params.x + params.width,
      top: params.y,
      bottom: params.y + params.height,
      cx: params.x + params.width / 2,
      cy: params.y + params.height / 2,
    };

    const otherRects = nodes
      .filter((node) => node.id !== data.id)
      .map((node) => {
        const width = Number(node.width ?? node.style?.width ?? 0);
        const height = Number(node.height ?? node.style?.height ?? 0);
        return {
          left: node.position.x,
          right: node.position.x + width,
          top: node.position.y,
          bottom: node.position.y + height,
          cx: node.position.x + width / 2,
          cy: node.position.y + height / 2,
        };
      })
      .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);

    const verticalMatches: Array<{ diff: number; candidate: number; start: number; end: number }> = [];
    const horizontalMatches: Array<{ diff: number; candidate: number; start: number; end: number }> = [];

    for (const other of otherRects) {
      const candidateX = [other.left, other.cx, other.right];
      const candidateY = [other.top, other.cy, other.bottom];
      const movingX = [moving.left, moving.cx, moving.right];
      const movingY = [moving.top, moving.cy, moving.bottom];

      for (const mx of movingX) {
        for (const cx of candidateX) {
          const diff = Math.abs(mx - cx);
          if (diff <= RESIZE_SNAP_THRESHOLD) {
            verticalMatches.push({
              diff,
              candidate: cx,
              start: Math.min(moving.top, other.top),
              end: Math.max(moving.bottom, other.bottom),
            });
          }
        }
      }

      for (const my of movingY) {
        for (const cy of candidateY) {
          const diff = Math.abs(my - cy);
          if (diff <= RESIZE_SNAP_THRESHOLD) {
            horizontalMatches.push({
              diff,
              candidate: cy,
              start: Math.min(moving.left, other.left),
              end: Math.max(moving.right, other.right),
            });
          }
        }
      }
    }

    const guides: ResizeGuide[] = [];

    if (verticalMatches.length > 0) {
      verticalMatches.sort((a, b) => a.diff - b.diff);
      const best = verticalMatches[0]!;
      guides.push({
        orientation: 'vertical',
        value: best.candidate,
        start: best.start,
        end: best.end,
      });
    }

    if (horizontalMatches.length > 0) {
      horizontalMatches.sort((a, b) => a.diff - b.diff);
      const best = horizontalMatches[0]!;
      guides.push({
        orientation: 'horizontal',
        value: best.candidate,
        start: best.start,
        end: best.end,
      });
    }

    setResizeGuides(guides);
  }, [data.id, nodes, setResizeGuides]);

  const handleResizeStart = useCallback(() => {
    clearResizeGuides();
  }, [clearResizeGuides]);

  const handleResize = useCallback((_event: unknown, params: ResizeParamsWithDirection) => {
    updateResizeGuides(params);
  }, [updateResizeGuides]);

  const handleResizeEnd = useCallback(() => {
    clearResizeGuides();
  }, [clearResizeGuides]);

  return (
    <div
      className={`group flex flex-col h-full rounded-lg overflow-visible shadow-2xl relative transition-shadow ${
        isSticker
          ? 'bg-amber-50/95 border border-amber-200/80 shadow-amber-900/10'
          : 'bg-gray-900/95 backdrop-blur-sm border border-gray-700/50'
      } ${selected ? 'ring-2 ring-cyan-400/70 ring-offset-1 ring-offset-gray-950 shadow-cyan-500/15' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showResizeHandles && RESIZE_HANDLE_POSITIONS.map((position) => (
        <NodeResizeControl
          key={position}
          nodeId={data.id}
          position={position}
          variant={ResizeControlVariant.Handle}
          minWidth={minWidth}
          minHeight={120}
          maxWidth={1200}
          maxHeight={800}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          className={`ct-resize-handle ${
            position.includes('-') ? 'ct-resize-handle-corner' : 'ct-resize-handle-edge'
          }`}
        >
          <ResizeHandleGlyph position={position} />
        </NodeResizeControl>
      ))}
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 select-none shrink-0 border-b ${
          isSticker ? 'bg-amber-100/80 border-amber-200/60' : 'bg-gray-800/80 border-gray-700/50'
        } ${isLocked ? 'cursor-default' : 'widget-drag-handle cursor-grab active:cursor-grabbing'}`}
      >
        <div className={`flex items-center gap-1.5 ${isSticker ? 'text-amber-700/70' : 'text-gray-400'}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            <circle cx="2" cy="5" r="1.5" fill="currentColor" />
            <circle cx="2" cy="8" r="1.5" fill="currentColor" />
            <circle cx="6" cy="2" r="1.5" fill="currentColor" />
            <circle cx="6" cy="5" r="1.5" fill="currentColor" />
            <circle cx="6" cy="8" r="1.5" fill="currentColor" />
          </svg>
        </div>

        <div className="min-w-0">
          <span className={`text-xs font-semibold uppercase tracking-wider truncate block ${isSticker ? 'text-amber-800' : 'text-gray-300'}`}>
            {label}
          </span>
          {!isSticker && description && (
            <span className="text-[10px] text-gray-500 truncate block max-w-[140px]">{description}</span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto nodrag shrink-0">
          <button
            onClick={() => updateWidgetData(data.id, { locked: !isLocked })}
            className={`p-1 rounded text-xs ${isLocked ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            title={isLocked ? 'Unlock position' : 'Lock position'}
          >
            {isLocked ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            )}
          </button>
          {data.type !== 'youtube' && data.type !== 'sticker' && (
            <>
              <input
                type="text"
                value={localTicker}
                onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
                onBlur={handleTickerSubmit}
                onKeyDown={handleKeyDown}
                className="w-16 px-1.5 py-0.5 text-xs bg-gray-700/60 border border-gray-600/40 rounded text-cyan-400 font-mono text-center focus:outline-none focus:border-cyan-500/50"
              />

              <button
            onClick={() => updateWidgetData(data.id, { syncTicker: !data.syncTicker })}
            className={`p-1 rounded text-xs ${data.syncTicker ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            title={data.syncTicker ? 'Synced' : 'Not synced'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16,6 12,2 8,6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
            </>
          )}

          <button
            onClick={async () => {
              const dataUrl = await captureWidget(data.id);
              if (dataUrl) {
                const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                downloadImage(dataUrl, `${data.type}-${ts}.png`);
              }
            }}
            className={`p-1 rounded hover:bg-gray-700/50 transition-opacity ${
              selected || isHovered ? 'opacity-100 text-gray-500 hover:text-gray-300' : 'opacity-0 pointer-events-none text-gray-500'
            }`}
            title="Capture widget"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
          </button>
          <button
            onClick={() => duplicateWidget(data.id)}
            className={`p-1 rounded hover:bg-gray-700/50 transition-opacity ${
              selected || isHovered ? 'opacity-100 text-gray-500 hover:text-gray-300' : 'opacity-0 pointer-events-none text-gray-500'
            }`}
            title="Duplicate"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>

          <button
            onClick={() => removeWidget(data.id)}
            className={`p-1 rounded hover:bg-red-500/10 transition-opacity ${
              selected || isHovered ? 'opacity-100 text-gray-500 hover:text-red-400' : 'opacity-0 pointer-events-none text-gray-500'
            }`}
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-3 nowheel min-h-0">
        {children}
      </div>
    </div>
  );
}

export const WidgetContainer = memo(WidgetContainerInner);

function ResizeHandleGlyph({ position }: { position: ControlPosition }) {
  if (position.includes('-')) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M1.5 8.5L8.5 1.5" />
        <path d="M5.5 8.5H8.5V5.5" />
      </svg>
    );
  }

  if (position === 'left' || position === 'right') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2 2.5v5" />
        <path d="M5 2.5v5" />
        <path d="M8 2.5v5" />
      </svg>
    );
  }

  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 2h5" />
      <path d="M2.5 5h5" />
      <path d="M2.5 8h5" />
    </svg>
  );
}
