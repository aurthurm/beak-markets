import { create } from 'zustand';
import {
  type Node,
  type Edge,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import { v4 as uuid } from 'uuid';
import type { WidgetConfig, WidgetType, Dashboard } from '../types';
import { WIDGET_DEFAULTS } from '../types';

const STORAGE_KEY = 'canvas-trader-layout';

export type CaptureMode = 'none' | 'area';
export type CanvasMode = 'pan' | 'select' | 'move';
export type ResizeGuide = {
  orientation: 'vertical' | 'horizontal';
  value: number;
  start: number;
  end: number;
};

type CanvasStore = {
  nodes: Node[];
  edges: Edge[];
  dashboards: Dashboard[];
  activeDashboardId: string | null;
  canvasMode: CanvasMode;
  showGrid: boolean;
  snapToGrid: boolean;
  captureMode: CaptureMode;
  resizeGuides: ResizeGuide[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addWidget: (type: WidgetType, position?: { x: number; y: number }, dashboardId?: string) => void;
  removeWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;
  updateWidgetData: (id: string, data: Partial<WidgetConfig>) => void;
  createDashboardFromSelection: (name?: string) => { id: string; name: string } | null;
  removeDashboard: (id: string) => void;
  renameDashboard: (id: string, name: string) => void;
  setActiveDashboard: (id: string | null) => void;
  setWidgetDashboard: (widgetId: string, dashboardId: string | null) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setResizeGuides: (guides: ResizeGuide[]) => void;
  clearResizeGuides: () => void;
  saveLayout: () => void;
  loadLayout: () => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
};

function loadFromStorage(): { nodes: Node[]; edges: Edge[]; dashboards?: Dashboard[]; activeDashboardId?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  dashboards: [],
  activeDashboardId: null,
  canvasMode: 'move' as CanvasMode,
  showGrid: true,
  snapToGrid: true,
  captureMode: 'none' as CaptureMode,
  resizeGuides: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  addWidget: (type, position, dashboardId) => {
    const defaults = WIDGET_DEFAULTS[type];
    const id = uuid();
    const { nodes, activeDashboardId } = get();
    const targetDashboardId = dashboardId ?? activeDashboardId ?? null;
    const existingNodes = nodes;
    const offset = existingNodes.length * 30;
    const newNode: Node = {
      id,
      type: 'widget',
      position: position ?? { x: 100 + offset, y: 100 + offset },
      data: {
        id,
        type,
        ticker: 'EUR/USD',
        syncTicker: true,
        locked: false,
        settings: {},
        dashboardId: targetDashboardId,
      } satisfies WidgetConfig,
      style: { width: defaults.width, height: defaults.height },
      width: defaults.width,
      height: defaults.height,
    };
    set({ nodes: [...existingNodes, newNode] });
  },

  removeWidget: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  duplicateWidget: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    const newId = uuid();
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, id: newId },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateWidgetData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },

  createDashboardFromSelection: (name) => {
    const { nodes } = get();
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) return null;
    const id = uuid();
    const dashboardName = name ?? `Dashboard ${get().dashboards.length + 1}`;
    const dashboards = [...get().dashboards, { id, name: dashboardName }];
    const updatedNodes = nodes.map((n) => {
      const cfg = n.data as WidgetConfig;
      return selectedIds.includes(n.id) ? { ...n, data: { ...cfg, dashboardId: id } } : n;
    });
    set({ dashboards, nodes: updatedNodes, activeDashboardId: id });
    return { id, name: dashboardName };
  },

  removeDashboard: (id) => {
    const { dashboards, nodes, activeDashboardId } = get();
    set({
      dashboards: dashboards.filter((d) => d.id !== id),
      nodes: nodes.map((n) => {
        const cfg = n.data as WidgetConfig;
        return cfg.dashboardId === id ? { ...n, data: { ...cfg, dashboardId: null } } : n;
      }),
      activeDashboardId: activeDashboardId === id ? null : activeDashboardId,
    });
  },

  renameDashboard: (id, name) => {
    set({
      dashboards: get().dashboards.map((d) => (d.id === id ? { ...d, name } : d)),
    });
  },

  setActiveDashboard: (id) => set({ activeDashboardId: id }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  setWidgetDashboard: (widgetId, dashboardId) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === widgetId ? { ...n, data: { ...n.data, dashboardId } } : n
      ),
    });
  },

  toggleGrid: () => set({ showGrid: !get().showGrid }),
  toggleSnap: () => set({ snapToGrid: !get().snapToGrid }),
  setCaptureMode: (mode) => set({ captureMode: mode }),
  setResizeGuides: (guides) => set({ resizeGuides: guides }),
  clearResizeGuides: () => set({ resizeGuides: [] }),

  saveLayout: () => {
    const { nodes, edges, dashboards, activeDashboardId } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, dashboards, activeDashboardId }));
  },

  loadLayout: () => {
    const saved = loadFromStorage();
    if (saved) {
      const dashboards = saved.dashboards ?? [];
      const nodes = (saved.nodes ?? []).map((n: Node) => {
        const cfg = n.data as WidgetConfig;
        return { ...n, data: { ...cfg, dashboardId: cfg.dashboardId ?? null } };
      });
      set({
        nodes,
        edges: saved.edges ?? [],
        dashboards,
        activeDashboardId: saved.activeDashboardId ?? null,
      });
    }
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
