export function riskReward(side: string, entry: string, stop: string, target: string): number | null {
  if (![entry, stop, target].every((v) => v.trim())) return null;
  const [e, s, t] = [entry, stop, target].map(Number);
  if (![e, s, t].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (side === 'long' && s < e && t > e) return (t - e) / (e - s);
  if (side === 'short' && s > e && t < e) return (e - t) / (s - e);
  return null;
}
