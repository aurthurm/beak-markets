import type { Node, Edge } from '@xyflow/react';
import { WIDGET_DEFAULTS, type Dashboard } from '../types';

type Workspace = { nodes: Node[]; edges: Edge[]; dashboards?: Dashboard[]; activeDashboardId?: string | null; globalTicker?: string };
export function parseWorkspace(raw: string): Workspace {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.dashboards ?? [])) throw new Error('Invalid workspace');
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!node || typeof node.id !== 'string' || ids.has(node.id) || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) ||
        !node.data || node.data.id !== node.id || !Object.hasOwn(WIDGET_DEFAULTS, node.data.type) || typeof node.data.ticker !== 'string' ||
        !node.data.settings || typeof node.data.settings !== 'object' || Array.isArray(node.data.settings)) throw new Error('Invalid widget');
    ids.add(node.id);
  }
  if (value.edges.some((edge: Edge) => !edge || !ids.has(edge.source) || !ids.has(edge.target))) throw new Error('Invalid connection');
  if ((value.dashboards ?? []).some((dashboard: Dashboard) => !dashboard || typeof dashboard.id !== 'string' || typeof dashboard.name !== 'string')) throw new Error('Invalid dashboard');
  if (value.globalTicker !== undefined && typeof value.globalTicker !== 'string') throw new Error('Invalid ticker');
  return value;
}
