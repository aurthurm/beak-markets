import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(name) {
  const source = await readFile(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source.replaceAll('import.meta.env', '({})'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { positionsFromTrades } = await load('portfolioMath');
const { riskReward } = await load('scenarioMath');
const trade = (side, quantity, price, ticker = 'EUR/USD') => ({ side, quantity, price, ticker });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('partial closes preserve basis and realize only closed quantity', () => {
  const [row] = positionsFromTrades([trade('buy', 1000, 1.1), trade('sell', 400, 1.2)], {'EUR/USD': 1.15});
  assert.equal(row.quantity, 600); close(row.avgPrice, 1.1); close(row.realizedPnl, 40); close(row.pnl, 30);
});
test('reversal closes long and opens remaining short at reversal fill', () => {
  const [row] = positionsFromTrades([trade('buy', 1000, 1.1), trade('sell', 1500, 1.2)], {'EUR/USD': 1.15});
  assert.equal(row.quantity, -500); close(row.avgPrice, 1.2); close(row.realizedPnl, 100); close(row.pnl, 25);
});
test('short closes, same-side average, flat and fractional quantity are accounted for', () => {
  const [row] = positionsFromTrades([trade('sell', 0.1, 150), trade('sell', 0.2, 153), trade('buy', 0.3, 151)], {});
  assert.equal(row.quantity, 0); assert.equal(row.avgPrice, 0); close(row.realizedPnl, 0.3);
});
test('missing and malformed quotes never manufacture zero P&L', () => {
  for (const quote of [undefined, NaN, Infinity, 0, -1]) {
    const [row] = positionsFromTrades([trade('buy', 1000, 1.1)], {'EUR/USD': quote});
    assert.equal(row.priceAvailable, false); assert.equal(row.currentPrice, null); assert.equal(row.pnl, null);
  }
});
test('different quote currencies remain separate and invalid trades do not poison ledger', () => {
  const rows = positionsFromTrades([trade('buy',1000,1.1),trade('buy',1000,150,'USD/JPY'),trade('buy',NaN,1.1)], {'EUR/USD':1.2,'USD/JPY':151});
  assert.equal(rows.length,2); close(rows[0].pnl,100); close(rows[1].pnl,1000);
});
test('reward/risk validates direction, blanks, nonfinite and wrong-side prices', () => {
  close(riskReward('long','1.1','1','1.3'),2); close(riskReward('short','150','151','148'),2);
  for (const args of [['long','','1','2'],['long','1','1','2'],['long','1','2','3'],['short','1','2','3'],['long','Infinity','1','2'],['long','0','1','2']]) assert.equal(riskReward(...args),null);
});
test('price requests deduplicate, retry failures, expire, and honor explicit refresh', async () => {
  const { marketService } = await load('marketService');
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  let count = 0, fail = true, now = 1_000_000;
  Date.now = () => now;
  globalThis.fetch = async () => { count++; await new Promise(resolve => setImmediate(resolve)); return { ok: !fail, json: async () => fail ? {detail:'Rate limited'} : {ticker:'EUR/USD',prices:[{timestamp:1,close:1.1}]} }; };
  try {
    await assert.rejects(marketService.getDataset('EUR/USD'), /Rate limited/); fail = false;
    await Promise.all([marketService.getDataset('EUR/USD'),marketService.getDataset('EUR/USD')]); assert.equal(count,2);
    await marketService.getDataset('EUR/USD'); assert.equal(count,2);
    now += 300_001; await marketService.getDataset('EUR/USD'); assert.equal(count,3);
    await marketService.getDataset('EUR/USD',true); assert.equal(count,4);
    await marketService.getDataset('EUR/USD',false,1000); assert.equal(count,5);
    await marketService.getDataset('EUR/USD'); assert.equal(count,5);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});

const { shiftBriefingDate, briefingPeriodLabel } = await load('briefingMath');
test('briefing navigation uses calendar days across month/year and leap boundaries', () => {
  assert.equal(shiftBriefingDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftBriefingDate('2024-03-01', -1), '2024-02-29');
  assert.equal(briefingPeriodLabel('2026-11-09', 'weekly', '2026-11-15'), 'This week');
  assert.equal(briefingPeriodLabel('2026-11-02', 'weekly', '2026-11-15'), 'Last week');
  assert.equal(briefingPeriodLabel('2026-11-15', 'daily', '2026-11-15'), 'Today');
  assert.equal(briefingPeriodLabel('2026-11-14', 'daily', '2026-11-15'), 'Yesterday');
});

const { aggregateCandles } = await load('chartTimeframes');
test('weekly/monthly OHLC aggregation honors UTC buckets, gaps and replay cutoffs', () => {
  const bar = (date, open, high, low, close, volume) => ({ticker:'EUR/USD', timestamp: Date.parse(`${date}T00:00:00Z`), open, high, low, close, volume});
  const rows = [bar('2026-10-30', 10, 12, 9, 11, 3), bar('2026-11-02', 11, 14, 10, 13, 5), bar('2026-11-03', 13, 15, 8, 9, 7), bar('2026-11-09', 9, 10, 7, 8, 2)];
  const weekly = aggregateCandles(rows, 'W');
  assert.equal(weekly.length, 3); assert.deepEqual([weekly[1].open,weekly[1].high,weekly[1].low,weekly[1].close,weekly[1].volume],[11,15,8,9,12]);
  const monthly = aggregateCandles(rows, 'M');
  assert.equal(monthly.length, 2); assert.equal(monthly[1].close,8); assert.equal(monthly[1].timestamp,rows[1].timestamp);
  assert.equal(aggregateCandles(rows.slice(0,2),'M')[1].close,13); // No future close leaks into replay.
  assert.equal(rows[1].close,13); assert.equal(aggregateCandles([], 'W').length,0);
});
test('EUR/USD example has four distinct chart roles and pins DXY independently', async () => {
  const { eurusdDeskWidgets } = await load('eurusdDesk');
  const charts = eurusdDeskWidgets.filter(w => w.type === 'chart');
  assert.equal(charts.length,4);
  assert.deepEqual(charts.filter(w=>w.ticker==='EUR/USD').map(w=>w.settings.chartTimeframe),['M','W','D']);
  assert.equal(charts[3].ticker,'DXY');
  assert.ok(eurusdDeskWidgets.some(w=>w.type==='scenario'));
});
