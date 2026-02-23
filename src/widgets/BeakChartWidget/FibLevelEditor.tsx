import { useCallback } from 'react';
import type { FibLevel } from '@beak/charts';
import { DEFAULT_FIB_LEVELS } from '@beak/charts';

type Props = {
  levels: FibLevel[];
  onChange: (levels: FibLevel[]) => void;
  onClose: () => void;
};

export function FibLevelEditor({ levels, onChange, onClose }: Props) {
  const update = useCallback((i: number, patch: Partial<FibLevel>) => {
    onChange(levels.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }, [levels, onChange]);

  const remove = useCallback((i: number) => {
    onChange(levels.filter((_, idx) => idx !== i));
  }, [levels, onChange]);

  const add = useCallback(() => {
    onChange([...levels, { ratio: 0.5, label: '0.5', visible: true }]);
  }, [levels, onChange]);

  const reset = useCallback(() => {
    onChange(DEFAULT_FIB_LEVELS.map(l => ({ ...l })));
  }, [onChange]);

  return (
    <div className="nodrag absolute z-20 top-10 right-2 w-[268px] rounded-lg border border-gray-700/60 bg-gray-900/95 backdrop-blur-md shadow-xl shadow-black/40 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-700/50">
        <span className="text-[11px] font-medium text-gray-200">Fibonacci Levels</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-200 transition-colors leading-none px-0.5"
        >
          ✕
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-1 px-2.5 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wide text-gray-600">
        <span className="w-3.5 shrink-0" />
        <span className="w-[72px] shrink-0">Ratio</span>
        <span className="flex-1">Label</span>
        <span className="w-4 shrink-0" />
      </div>

      {/* Levels */}
      <div className="px-2 pb-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
        {levels.map((level, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={level.visible}
              onChange={e => update(i, { visible: e.target.checked })}
              className="w-3 h-3 shrink-0 accent-cyan-400 cursor-pointer"
            />
            <input
              type="number"
              value={level.ratio}
              min={-2}
              max={3}
              step={0.001}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) update(i, { ratio: v });
              }}
              className="w-[72px] shrink-0 h-5 px-1 rounded bg-gray-800 border border-gray-700/60 text-[10px] font-mono text-gray-200 focus:outline-none focus:border-cyan-500/50"
            />
            <input
              type="text"
              value={level.label}
              onChange={e => update(i, { label: e.target.value })}
              className="flex-1 min-w-0 h-5 px-1 rounded bg-gray-800 border border-gray-700/60 text-[10px] text-gray-200 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={() => remove(i)}
              title="Remove level"
              className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-600 hover:text-rose-400 transition-colors"
            >
              <XIcon />
            </button>
          </div>
        ))}
        {levels.length === 0 && (
          <div className="text-[10px] text-gray-600 text-center py-2">No levels — add one below</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-t border-gray-700/50">
        <button
          onClick={add}
          className="flex items-center gap-1 h-5 px-2 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-300 transition-colors"
        >
          <span className="text-xs font-bold">+</span> Add
        </button>
        <div className="flex-1" />
        <button
          onClick={reset}
          className="h-5 px-2 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400 transition-colors"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="2" y1="2" x2="8" y2="8" />
      <line x1="8" y1="2" x2="2" y2="8" />
    </svg>
  );
}
