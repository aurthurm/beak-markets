import { useCallback, useEffect, useState } from 'react';
import { researchRequest } from '../../services/researchService';

export function useResearch<T>(path: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ path: string; revision: number; data?: T; error?: string }>({ path: '', revision: -1 });
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    const interval = window.setInterval(refresh, 300_000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    researchRequest<T>(path, controller.signal).then((data) => {
      if (active) setState({ path, revision, data });
    }).catch((e: unknown) => {
      if (active) setState({ path, revision, error: controller.signal.aborted ? 'Request timed out. Check the backend and retry.' : e instanceof Error ? e.message : 'Could not load research.' });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [path, revision]);
  const matches = state.path === path && state.revision === revision;
  return { data: matches ? state.data : undefined, error: matches ? state.error : undefined, loading: !matches, refresh };
}
