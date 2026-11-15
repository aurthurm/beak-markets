import { useState } from 'react';
import type { WidgetConfig } from '../../types';
import { useCanvasStore } from '../../store/useCanvasStore';
import { riskReward } from '../../services/scenarioMath';
import { fieldClass, buttonClass } from './styles';

type Plan = { pair: string; side: string; thesis: string; catalyst: string; trigger: string; invalidation: string; source: string; entry: string; stop: string; target: string; outcome: string; status: string };
const blankPlan = (ticker: string): Plan => ({ pair: ticker, side: 'long', thesis: '', catalyst: '', trigger: '', invalidation: '', source: '', entry: '', stop: '', target: '', outcome: '', status: 'draft' });

export default function Scenario({ data, ticker }: { data: WidgetConfig; ticker: string }) {
  const update = useCanvasStore((s) => s.updateWidgetData);
  const saveLayout = useCanvasStore((s) => s.saveLayout);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const saved = data.settings.scenario as Partial<Plan> | undefined;
  const plan = { ...blankPlan(ticker), ...saved };
  const rr = riskReward(plan.side, plan.entry, plan.stop, plan.target);
  const change = (key: keyof Plan, value: string) => {
    setMessage('Unsaved changes');
    update(data.id, { settings: { ...data.settings, scenario: { ...plan, [key]: value } } });
  };
  const save = async () => {
    setSaving(true);
    try {
      saveLayout();
      setMessage('Plan saved with this canvas on this device');
    } catch { setMessage('Save failed. Check available browser storage.'); }
    finally { setSaving(false); }
  };
  return <div className="nodrag nowheel h-full overflow-y-auto space-y-3 text-xs">
    <p className="text-gray-400 leading-relaxed">Write the macro reason, the event that could move price, and the exact confirmation you need. This records a plan; it does not place orders.</p>
    {plan.pair !== ticker && <p className="text-amber-300">This plan belongs to {plan.pair}. Changing the canvas ticker does not change a saved trade plan.</p>}
    <div className="grid grid-cols-2 gap-3">
      <label className="text-gray-400 space-y-1 block">Plan pair<input aria-label="Plan pair" className={fieldClass} value={plan.pair} onChange={(e) => change('pair', e.target.value.toUpperCase())} /></label>
      <label className="text-gray-400 space-y-1 block">Direction<select className={fieldClass} value={plan.side} onChange={(e) => change('side', e.target.value)}><option value="long">Long</option><option value="short">Short</option></select></label>
    </div>
    {([['thesis', 'Macro thesis'], ['source', 'Evidence / source links'], ['catalyst', 'Catalyst and expected surprise'], ['trigger', 'Measurable entry condition'], ['invalidation', 'What would invalidate the thesis?']] as const).map(([key, label]) => <label key={key} className="block text-gray-400 space-y-1">{label}<textarea className={fieldClass} rows={2} value={plan[key]} onChange={(e) => change(key, e.target.value)} /></label>)}
    <div className="grid grid-cols-3 gap-2">{(['entry', 'stop', 'target'] as const).map((key) => <label key={key} className="text-gray-400 capitalize space-y-1 block">{key}<input aria-label={key} className={fieldClass} inputMode="decimal" value={plan[key]} onChange={(e) => change(key, e.target.value)} /></label>)}</div>
    <p className={rr === null ? 'text-gray-500' : 'text-cyan-300'}>{rr === null ? 'Enter positive prices with stop and target on the correct sides of entry.' : `Planned reward / risk: ${rr.toFixed(2)}R before spread, slippage and financing.`}</p>
    <label className="block text-gray-400 space-y-1">Status<select className={fieldClass} value={plan.status} onChange={(e) => change('status', e.target.value)}>{['draft', 'watching', 'triggered', 'invalidated', 'closed'].map((s) => <option key={s}>{s}</option>)}</select></label>
    <label className="block text-gray-400 space-y-1">Review / outcome<textarea className={fieldClass} rows={2} value={plan.outcome} onChange={(e) => change('outcome', e.target.value)} /></label>
    <div className="flex gap-3 items-center"><button className={buttonClass} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button><span role="status" className="text-[10px] text-gray-400">{message}</span></div>
  </div>;
}
