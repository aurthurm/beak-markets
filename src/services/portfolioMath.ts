import type { Trade, PortfolioPosition } from '../types';
export function positionsFromTrades(trades: Trade[], prices: Record<string, number>): PortfolioPosition[] {
  const ledger = new Map<string, { qty: number; avg: number; realized: number }>();
  for (const trade of trades) {
    if (!Number.isFinite(trade.quantity) || trade.quantity <= 0 || !Number.isFinite(trade.price) || trade.price <= 0) continue;
    const row=ledger.get(trade.ticker) ?? {qty:0,avg:0,realized:0};
    const delta=trade.side==='buy' ? trade.quantity : -trade.quantity;
    if (row.qty===0 || Math.sign(row.qty)===Math.sign(delta)) {
      row.avg=(Math.abs(row.qty)*row.avg+Math.abs(delta)*trade.price)/(Math.abs(row.qty)+Math.abs(delta));
    } else {
      row.realized+=Math.min(Math.abs(row.qty),Math.abs(delta))*(trade.price-row.avg)*Math.sign(row.qty);
      if (Math.abs(delta)>Math.abs(row.qty)) row.avg=trade.price;
    }
    row.qty+=delta;
    if (Math.abs(row.qty) < 1e-9) row.qty = 0;
    if (row.qty===0) row.avg=0;
    ledger.set(trade.ticker,row);
  }
  return [...ledger.entries()].map(([ticker,row]) => {
    const raw=prices[ticker];
    const current=Number.isFinite(raw) && raw>0 ? raw : undefined;
    return {ticker,quantity:row.qty,avgPrice:row.avg,currentPrice:current ?? null,
      pnl: current===undefined ? null : (current-row.avg)*row.qty,
      realizedPnl:row.realized,priceAvailable:current!==undefined};
  });
}
