import { useCallback, useRef, useState } from 'react';
import type { ScreenRect } from '../utils/capture';

type Props = {
  onComplete: (rect: ScreenRect) => void;
  onCancel: () => void;
};

export default function SelectionOverlay({ onComplete, onCancel }: Props) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setStart({ x, y });
      setCurrent({ x, y });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!start) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrent({ x, y });
    },
    [start]
  );

  const [completedRect, setCompletedRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const handleMouseUp = useCallback(() => {
    if (!start || !current || !containerRef.current) return;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    if (width >= 10 && height >= 10) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const rect = {
        left: containerRect.left + x,
        top: containerRect.top + y,
        width,
        height,
      };
      setCompletedRect({ left: x, top: y, width, height });
      onComplete(rect);
      // Don't clear start/current - keep selection visible until overlay unmounts
    } else {
      setStart(null);
      setCurrent(null);
    }
  }, [start, current, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCompletedRect(null);
        setStart(null);
        setCurrent(null);
        onCancel();
      }
    },
    [onCancel]
  );

  const selectionRect =
    completedRect ??
    (start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Select area to capture"
    >
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-gray-950/40" />

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 rounded-lg text-sm text-gray-300 shadow-xl">
        Drag to select an area • Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> to cancel
      </div>

      {/* Selection rectangle */}
      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <div
          className="absolute border-2 border-cyan-400 bg-cyan-500/10 pointer-events-none"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}
    </div>
  );
}
