import { useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type OnConnect,
  addEdge,
  type Connection,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  ViewportPortal,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMemo } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { WIDGET_DRAG_DATA_KEY } from '../constants';
import type { WidgetType, WidgetConfig } from '../types';
import { WIDGET_DEFAULTS } from '../types';
import { WidgetNode } from './WidgetNode';

const nodeTypes: NodeTypes = {
  widget: WidgetNode,
};

function ResizeGuidesOverlay() {
  const resizeGuides = useCanvasStore((s) => s.resizeGuides);
  if (resizeGuides.length === 0) return null;

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 z-[80]">
        {resizeGuides.map((guide, idx) => (
          guide.orientation === 'vertical' ? (
            <div
              key={`${guide.orientation}-${idx}`}
              className="absolute border-l border-cyan-300/80"
              style={{
                left: guide.value,
                top: guide.start,
                height: Math.max(0, guide.end - guide.start),
              }}
            />
          ) : (
            <div
              key={`${guide.orientation}-${idx}`}
              className="absolute border-t border-cyan-300/80"
              style={{
                top: guide.value,
                left: guide.start,
                width: Math.max(0, guide.end - guide.start),
              }}
            />
          )
        ))}
      </div>
    </ViewportPortal>
  );
}

function CanvasInner() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const saveLayout = useCanvasStore((s) => s.saveLayout);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const addWidget = useCanvasStore((s) => s.addWidget);
  const activeDashboardId = useCanvasStore((s) => s.activeDashboardId);
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const setCanvasMode = useCanvasStore((s) => s.setCanvasMode);
  const removeSelectedWidgets = useCanvasStore((s) => s.removeSelectedWidgets);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = (e.dataTransfer.getData(WIDGET_DRAG_DATA_KEY) ||
        e.dataTransfer.getData('text/plain')) as WidgetType;
      if (!type || !WIDGET_DEFAULTS[type]) return;
      const position = screenToFlowPosition(
        { x: e.clientX, y: e.clientY },
        { snapToGrid }
      );
      addWidget(type, position);
    },
    [screenToFlowPosition, snapToGrid, addWidget]
  );

  // Fit view to active dashboard only when switching dashboards (not on node selection/position changes)
  useLayoutEffect(() => {
    const currentNodes = useCanvasStore.getState().nodes;
    if (activeDashboardId === null) {
      if (currentNodes.length > 0) {
        fitView({ nodes: currentNodes.map((n) => ({ id: n.id })), padding: 0.15, duration: 300 });
      }
    } else {
      const dashboardNodeIds = currentNodes
        .filter((n) => (n.data as { dashboardId?: string | null }).dashboardId === activeDashboardId)
        .map((n) => n.id);
      if (dashboardNodeIds.length > 0) {
        fitView({ nodes: dashboardNodeIds.map((id) => ({ id })), padding: 0.15, duration: 300 });
      }
    }
  }, [activeDashboardId, fitView]);

  // Delete selected widgets with Delete / Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;
      e.preventDefault();
      removeSelectedWidgets();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeSelectedWidgets]);

  // Auto-save layout on changes
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLayout(), 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, saveLayout]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges(addEdge(connection, edges));
    },
    [edges, setEdges]
  );

  const nodesWithDraggable = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        draggable: !(n.data as WidgetConfig).locked,
      })),
    [nodes]
  );

  const controlBtn =
    'flex items-center justify-center w-8 h-8 p-1 border-0 border-r border-gray-600 last:border-r-0 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50';

  const handleFitView = useCallback(() => {
    const currentNodes = useCanvasStore.getState().nodes;
    const activeId = useCanvasStore.getState().activeDashboardId;
    if (activeId === null) {
      fitView({ nodes: currentNodes.map((n) => ({ id: n.id })), padding: 0.15, duration: 300 });
    } else {
      const ids = currentNodes
        .filter((n) => (n.data as { dashboardId?: string | null }).dashboardId === activeId)
        .map((n) => n.id);
      if (ids.length > 0) fitView({ nodes: ids.map((id) => ({ id })), padding: 0.15, duration: 300 });
      else fitView({ nodes: currentNodes.map((n) => ({ id: n.id })), padding: 0.15, duration: 300 });
    }
  }, [fitView]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodesWithDraggable}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={4}
        panOnDrag={canvasMode === 'pan'}
        selectionOnDrag={canvasMode === 'select'}
        nodesDraggable={canvasMode === 'move'}
        autoPanOnNodeFocus={false}
        defaultEdgeOptions={{
          style: { stroke: '#06b6d4', strokeWidth: 2 },
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-950"
      >
        {showGrid && (
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        )}
        <ResizeGuidesOverlay />
        <MiniMap
          nodeColor="#1e293b"
          maskColor="rgba(0,0,0,0.7)"
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>

      {/* Custom control bar — outside React Flow so it's never affected by pan mode */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex rounded-md overflow-hidden shadow-lg border border-gray-600"
        style={{ backgroundColor: '#1e293b' }}
      >
        <button
          type="button"
          onClick={() => setCanvasMode('move')}
          title="Move mode — click anywhere on a widget to drag it"
          className={`${controlBtn} ${canvasMode === 'move' ? 'bg-cyan-500/30 text-cyan-400' : ''}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            <path d="m4.93 4.93 2.83 2.83m8.48 8.48 2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setCanvasMode('pan')}
          title="Pan mode — drag to move canvas"
          className={`${controlBtn} ${canvasMode === 'pan' ? 'bg-cyan-500/30 text-cyan-400' : ''}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-16 0v-2a2 2 0 1 1 4 0V8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setCanvasMode('select')}
          title="Selection mode — drag to select widgets"
          className={`${controlBtn} ${canvasMode === 'select' ? 'bg-cyan-500/30 text-cyan-400' : ''}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-600 self-center" aria-hidden />

        <button
          type="button"
          onClick={() => zoomOut()}
          title="Zoom out"
          className={controlBtn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => zoomIn()}
          title="Zoom in"
          className={controlBtn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleFitView}
          title="Recenter — fit all widgets in view"
          className={controlBtn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function CanvasEngine() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
