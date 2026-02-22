import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useSimulationStore } from '../store/useSimulationStore';
import { useTickerStore } from '../store/useTickerStore';
import { simulationService } from '../services/simulationService';
import { captureWidget, downloadImage } from '../utils/capture';
import type { WidgetConfig } from '../types';

export default function Toolbar() {
  const toggleGrid = useCanvasStore((s) => s.toggleGrid);
  const toggleSnap = useCanvasStore((s) => s.toggleSnap);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const saveLayout = useCanvasStore((s) => s.saveLayout);
  const nodes = useCanvasStore((s) => s.nodes);
  const setCaptureMode = useCanvasStore((s) => s.setCaptureMode);
  const dashboards = useCanvasStore((s) => s.dashboards);
  const activeDashboardId = useCanvasStore((s) => s.activeDashboardId);
  const setActiveDashboard = useCanvasStore((s) => s.setActiveDashboard);
  const createDashboardFromSelection = useCanvasStore((s) => s.createDashboardFromSelection);
  const renameDashboard = useCanvasStore((s) => s.renameDashboard);
  const removeDashboard = useCanvasStore((s) => s.removeDashboard);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [editingDashboardId, setEditingDashboardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const captureRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (captureRef.current && !captureRef.current.contains(e.target as Node)) {
        setCaptureOpen(false);
      }
      if (dashboardRef.current && !dashboardRef.current.contains(e.target as Node)) {
        setDashboardOpen(false);
        setEditingDashboardId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId);
  const handleDashboardSelect = (id: string | null) => {
    setActiveDashboard(id);
    setDashboardOpen(false);
    setEditingDashboardId(null);
  };

  const selectedCount = nodes.filter((n) => n.selected).length;
  const handleCreateFromSelection = () => {
    const result = createDashboardFromSelection();
    if (result) {
      setEditingDashboardId(result.id);
      setEditingName(result.name);
      setDashboardOpen(true);
    }
  };

  const handleRenameSubmit = (id: string) => {
    if (editingName.trim()) {
      renameDashboard(id, editingName.trim());
    }
    setEditingDashboardId(null);
    setEditingName('');
  };

  const selectedNode = nodes.find((n) => n.selected);
  const hasSelection = !!selectedNode;

  const handleCaptureWidget = async () => {
    setCaptureOpen(false);
    const nodeId = selectedNode?.id;
    if (!nodeId) return;
    const dataUrl = await captureWidget(nodeId);
    if (dataUrl) {
      const label = (selectedNode.data as { type?: string })?.type ?? 'widget';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadImage(dataUrl, `${label}-${ts}.png`);
    }
  };

  const handleCaptureArea = () => {
    setCaptureOpen(false);
    setCaptureMode('area');
  };

  const playing = useSimulationStore((s) => s.playing);
  const speed = useSimulationStore((s) => s.speed);
  const currentIndex = useSimulationStore((s) => s.currentIndex);
  const play = useSimulationStore((s) => s.play);
  const pause = useSimulationStore((s) => s.pause);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const reset = useSimulationStore((s) => s.reset);

  const globalTicker = useTickerStore((s) => s.globalTicker);

  const handlePlayPause = () => {
    if (playing) {
      pause();
      simulationService.stop();
    } else {
      play();
      simulationService.start();
    }
  };

  const handleExport = () => {
    const data = localStorage.getItem('canvas-trader-layout');
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'canvas-trader-workspace.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          localStorage.setItem('canvas-trader-layout', JSON.stringify(data));
          window.location.reload();
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-gray-900/95 backdrop-blur-md border-b border-gray-800/80">
      {/* Left: Brand + Widget Menu */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">CT</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">CanvasTrader</span>
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Active ticker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 uppercase">Active:</span>
          <span className="text-xs font-bold text-cyan-400 font-mono">{globalTicker}</span>
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Dashboard dropdown */}
        <div className="relative" ref={dashboardRef}>
          <button
            onClick={() => setDashboardOpen((o) => !o)}
            className="px-2 py-1 text-[10px] text-gray-300 hover:text-white rounded border border-gray-700 hover:border-gray-500 flex items-center gap-1.5 min-w-[120px] justify-between"
            title="Switch dashboard"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="truncate">{activeDashboard?.name ?? 'All'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${dashboardOpen ? 'rotate-180' : ''}`}>
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </button>
          {dashboardOpen && (
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[180px] max-h-[320px] overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[60]">
              <button
                onClick={() => handleDashboardSelect(null)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                  activeDashboardId === null ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="truncate flex-1">All</span>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {nodes.length} widgets
                </span>
              </button>
              {dashboards.map((d) => (
                <div key={d.id} className="group/dash flex items-center gap-1">
                  {editingDashboardId === d.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameSubmit(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(d.id);
                        if (e.key === 'Escape') setEditingDashboardId(null);
                      }}
                      autoFocus
                      className="flex-1 mx-2 py-1.5 px-2 text-xs bg-gray-800 border border-cyan-500/50 rounded text-white focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => handleDashboardSelect(d.id)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                        d.id === activeDashboardId
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="truncate flex-1">{d.name}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {nodes.filter((n) => (n.data as WidgetConfig).dashboardId === d.id).length} widgets
                      </span>
                    </button>
                  )}
                  {editingDashboardId !== d.id && (
                    <button
                      onClick={() => removeDashboard(d.id)}
                      className="opacity-0 group-hover/dash:opacity-100 p-1 mr-1 rounded text-gray-500 hover:text-red-400 transition-opacity"
                      title="Remove dashboard"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <div className="border-t border-gray-700 mt-1 pt-1 space-y-0.5">
                <button
                  onClick={handleCreateFromSelection}
                  disabled={selectedCount === 0}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 hover:bg-cyan-500/10 disabled:hover:bg-transparent"
                  title={selectedCount > 0 ? `Create dashboard from ${selectedCount} selected widget(s)` : 'Select widgets first'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <path d="M8 14v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4" />
                  </svg>
                  Create from selection ({selectedCount})
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Center: Simulation Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => reset()}
          className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
          title="Reset"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1,4 1,10 7,10" />
            <path d="M3.51 15a9 9 0 105.38-12.5L1 10" />
          </svg>
        </button>

        <button
          onClick={handlePlayPause}
          className={`p-1.5 rounded transition-colors ${playing ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-1">
          {[1, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                speed === s ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="text-[10px] text-gray-500 font-mono">
          Day {currentIndex + 1}/252
        </span>
      </div>

      {/* Right: Canvas Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleGrid}
          className={`px-2 py-1 text-[10px] rounded border ${
            showGrid ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-gray-700 text-gray-500'
          }`}
        >
          Grid
        </button>
        <button
          onClick={toggleSnap}
          className={`px-2 py-1 text-[10px] rounded border ${
            snapToGrid ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-gray-700 text-gray-500'
          }`}
        >
          Snap
        </button>

        <div className="h-4 w-px bg-gray-700" />

        <div className="relative" ref={captureRef}>
          <button
            onClick={() => setCaptureOpen((o) => !o)}
            className="px-2 py-1 text-[10px] text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500 flex items-center gap-1"
            title="Screenshot"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
            Capture
          </button>
          {captureOpen && (
            <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[60]">
              <button
                onClick={handleCaptureWidget}
                disabled={!hasSelection}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={hasSelection ? 'Capture selected widget' : 'Select a widget first'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                Capture widget
              </button>
              <button
                onClick={handleCaptureArea}
                className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                title="Select an area to capture"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4 2" />
                </svg>
                Capture area
              </button>
            </div>
          )}
        </div>

        <button
          onClick={saveLayout}
          className="px-2 py-1 text-[10px] text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500"
        >
          Save
        </button>
        <button
          onClick={handleExport}
          className="px-2 py-1 text-[10px] text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500"
        >
          Export
        </button>
        <button
          onClick={handleImport}
          className="px-2 py-1 text-[10px] text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500"
        >
          Import
        </button>
      </div>
    </div>
  );
}
