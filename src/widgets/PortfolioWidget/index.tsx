import { useEffect, useState } from 'react';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { marketService } from '../../services/marketService';
import { positionsFromTrades } from '../../services/portfolioMath';
import { fieldClass, buttonClass } from '../ResearchWidgets/styles';

export default function PortfolioWidget() {
  const trades=usePortfolioStore((s)=>s.trades);
  const addTrade=usePortfolioStore((s)=>s.addTrade);
  const [ticker,setTicker]=useState('EUR/USD');
  const [entryPrice,setEntryPrice]=useState('');
  const [side,setSide]=useState<'buy'|'sell'>('buy');
  const [qty,setQty]=useState('1000');
  const [priceDates,setPriceDates]=useState<Record<string,string>>({});
  const [prices,setPrices]=useState<Record<string,number>>({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    const symbols=[...new Set(trades.map((t)=>t.ticker))];
    Promise.allSettled(symbols.map(async (t)=>{const dataset=await marketService.getDataset(t); const bar=dataset.prices.at(-1)!; return [t,bar.close,new Date(bar.timestamp).toISOString().slice(0,10)] as const;})).then((results)=>{
      if (!active)return;
      setPriceDates(Object.fromEntries(results.flatMap((r)=>r.status==='fulfilled'?[[r.value[0],r.value[2]]]:[])));
      setPrices(Object.fromEntries(results.flatMap((r)=>r.status==='fulfilled'?[[r.value[0],r.value[1]]]:[])));
    });
    return ()=>{active=false;};
  },[trades]);
  const positions=positionsFromTrades(trades,prices);
  const record=async()=>{
    if (!Number.isFinite(Number(qty)) || Number(qty)<=0) {setError('Enter positive base units.');return;}
    setBusy(true);setError('');
    try { const price=entryPrice.trim() ? Number(entryPrice) : await marketService.getLatestPrice(ticker);if (!Number.isFinite(price) || !(price>0))throw new Error('Price unavailable');addTrade({ticker,side,quantity:Number(qty),price}); }
    catch(e){setError(e instanceof Error?e.message:'Could not fetch a price.');}
    finally{setBusy(false);}
  };
  return <div className="nodrag nowheel h-full overflow-y-auto space-y-3 text-xs">
    <p className="text-gray-400">Paper ledger using latest available daily prices. Quantities are base units; P&amp;L is in each pair’s quote currency. No order is sent.</p>
    <label className="text-gray-400 block">Pair<select className={fieldClass} value={ticker} onChange={(e)=>setTicker(e.target.value)}>{marketService.getAvailableTickers().filter(p=>p.ticker.includes('/') && !p.ticker.startsWith('XAU')).map(p=><option key={p.ticker}>{p.ticker}</option>)}</select></label>
    <label className="text-gray-400 block">Side<select className={fieldClass} value={side} onChange={(e)=>setSide(e.target.value as 'buy'|'sell')}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
    <label className="text-gray-400 block">Base units<input className={fieldClass} value={qty} onChange={(e)=>setQty(e.target.value)} inputMode="decimal" /></label>
    <label className="text-gray-400 block">Paper fill price (optional)<input className={fieldClass} value={entryPrice} onChange={(e)=>setEntryPrice(e.target.value)} inputMode="decimal" placeholder="Blank uses latest daily close" /></label>
    <button className={buttonClass} disabled={busy} onClick={record}>{busy?'Fetching price…':'Record paper trade'}</button>
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {positions.map(p=><div key={p.ticker} className="border-t border-gray-700 pt-2 space-y-1 text-gray-300"><p>{p.ticker} · {p.quantity} base units</p><p>Average {p.avgPrice.toFixed(5)}</p><p className="text-[10px] text-gray-500">Daily mark: {priceDates[p.ticker] || 'Unavailable'}</p><p>Unrealized: {p.priceAvailable ? `${p.pnl?.toFixed(2)} ${p.ticker.split('/')[1]}` : 'Price unavailable'}</p><p>Realized: {p.realizedPnl?.toFixed(2)} {p.ticker.split('/')[1]}</p></div>)}
    {trades.length>0 && <details><summary className="text-gray-400 cursor-pointer">Paper trade journal ({trades.length})</summary>{trades.map(trade=><p key={trade.id} className="text-gray-400 py-1">{new Date(trade.timestamp).toLocaleString()} · {trade.ticker} {trade.side} {trade.quantity} @ {trade.price}</p>)}</details>}
    {trades.length===0 && <p className="text-gray-500">No paper trades yet.</p>}
    <p className="text-[10px] text-gray-500">No cross-currency total or fabricated equity curve. Paper trades are saved on this device across reloads.</p>
  </div>;
}
