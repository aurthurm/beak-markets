# EUR/USD multi-timeframe example — 15 November 2026

Open http://127.0.0.1:5173/ and click **EUR/USD desk** in the sidebar. The button creates a separate dashboard once, then reopens it. Existing dashboards are preserved. It was created and saved in the test browser.

## Layout and workflow

Four charts in a 2-by-2 workbench:

1. EUR/USD monthly: broad structure, up to 1,000 observed daily bars aggregated into monthly candles.
2. EUR/USD weekly: weekly bias with SMA20; initially displays the most recent 78 candles.
3. EUR/USD daily: setup detail with EMA12 and SMA20; initially displays the latest 100 candles.
4. DXY daily: dollar context with SMA20; pinned to DXY independently of the global ticker. DXY includes a substantial EUR weight, so it is not independent EUR/USD confirmation. Changes display in index points.

The right column holds the EUR/USD-related weekly macro briefing and its linked news/opinion evidence. Below: economic calendar, daily range breach/rejection scanner, a conditional example scenario and a research-routine note. Zoom/pan the infinite canvas for readable detail; the fit-all view shows the full workflow.

The example scenario is explicitly educational, not a current trade recommendation. Entry/stop/target are blank. No orders are sent. OpenAI briefing generation retains its separate paid-consent control and needs a backend OPENAI_API_KEY; this dashboard makes no paid call.

## Timeframe behavior

Chart buttons 1M/1W/1D are saved per widget. Daily bars come from the existing Yahoo/SQLite endpoint. Weekly bars use Monday UTC buckets; monthly bars use calendar months. Aggregates preserve first observed open, max high, min low, last observed close and summed provider volume. The timestamp stays the first observed session. No missing candles are fabricated. Edge periods can be incomplete; weekends and missing provider sessions remain absent. No hourly data or live-price claim is made.

Monthly/weekly charts use the existing 1,000-bar history option. They align their cutoff with the instrument's 252-bar replay dataset *before* aggregation, preventing future daily closes from leaking into earlier weekly/monthly bars. Replay dates can still differ across instruments because their trading calendars differ. Cache keys now include requested history length, so the longer series cannot replace the standard replay dataset. The initial view shows approximately 60 monthly, 78 weekly or 100 daily candles; chart pan/zoom remains available.

## Verification

- TypeScript/Vite production build passed; existing large-bundle warning remains (~1.93 MB before gzip).
- 10 frontend behavioral tests passed, including OHLC aggregation, UTC week/month boundaries, gaps, replay cutoff, non-mutation, distinct chart roles, and history-cache separation.
- Targeted ESLint passed for all changed source modules.
- Browser: created dashboard, observed four populated charts, changed an individual timeframe and restored it, saved and reopened the app with settings intact. DXY remained separate. News/calendar/scanner sources rendered, and the example plan persisted. No console warnings/errors in the final fresh tab.
- Live observed: EUR/USD 49 monthly / 208 weekly / 252 daily candles; DXY 250 daily candles. Latest underlying daily session was 2026-11-13. Provider availability and counts change over time.

## Portable example

`eurusd-desk.json` is a clean nine-widget workspace containing only this example. Import replaces the current workspace, so export your existing workspace first. Prefer the sidebar button when preserving dashboards. Chart source modules and the clean preset are synchronized to `/run/media/administrator/storage/aurthurm/fx/markets-canvas` without copying databases, secrets or dependencies.

Changes: `canvas-trader/src/services/chartTimeframes.ts`, `eurusdDesk.ts`, `marketService.ts`, `widgets/ChartWidget/index.tsx`, `store/useCanvasStore.ts`, `components/WidgetSidebar.tsx`, `canvas/WidgetNode.tsx`, `canvas/WidgetContainer.tsx`, `tests/research.test.mjs`.

Pre-change backups: `/run/media/administrator/storage/aurthurm/fx/eurusd-desk-backup-20261115/`.
