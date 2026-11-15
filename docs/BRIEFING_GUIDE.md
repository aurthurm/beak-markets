# AI Macro Briefing — OpenAI

Added 15 November 2026 to the original CanvasTrader application. React Flow, Vite, FastAPI, SQLModel and SQLite are retained.

## Use

Open http://127.0.0.1:5173/. Add **AI Macro Briefing** from the sidebar, or click **Research desk** to create a desk containing it. Existing dashboards are preserved.

1. Click **Refresh sources** to archive public headlines, excerpts and scheduled calendar events. This is free and makes no AI request.
2. Choose **Daily** or **Weekly**, **Today / This week / Last week**, a period tab, or a date. Weeks start Monday in the browser's IANA timezone. The date input supports its native picker and keyboard controls.
3. Choose global macro or the widget pair. Pair relevance uses currency keywords, not a full semantic model. Filter evidence by official statements, news, analyst opinion or calendar events; follow original-source links.
4. With a backend key configured, explicitly check the paid-generation box and click **Generate AI briefing · paid**. Only that period's selected evidence is sent to OpenAI. There is no automatic generation or paid retry.
5. Saved briefings load without payment. Changed source coverage is flagged; generating an updated version requires another explicit paid action. Each version keeps its original evidence snapshot.

Briefings include cited macro drivers, interpreted risk tone, analyst perspectives, counterarguments, catalysts and optional conditional trade scenarios with confirmation, invalidation and risks. They do not execute trades. No summary is fabricated when a key or evidence is missing.

## Configure OpenAI and run

Set **OPENAI_API_KEY** in the backend process environment using your own local terminal or secret manager. Do not put it in Vite variables, canvas notes, exports or source control. A `.env` file is not loaded automatically by this integration. Restart the backend after setting it.

Optional **BRIEFING_AI_MODEL** overrides the default `gpt-5.4-mini`. Choose a model supporting Responses structured JSON output. No Anthropic key is used.

Backend after exporting the environment variables:

```sh
rtk proxy sh -c 'cd /home/administrator/Documents/Development/beak-insights/markets-canvas/canvas-backend && PYTHONPATH=src .venv/bin/python -m uvicorn canvas_backend.main:app --host 127.0.0.1 --port 8001'
```

Frontend, another terminal:

```sh
rtk proxy sh -c 'cd /home/administrator/Documents/Development/beak-insights/markets-canvas/canvas-trader && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort'
```

API docs: http://127.0.0.1:8001/docs. API root: http://127.0.0.1:8001/api. Working copies under `/run/media/administrator/storage/aurthurm/fx/markets-canvas` use the same commands with that parent path; start only one copy per port.

## API contract

| Method and path | Behavior |
| --- | --- |
| GET `/api/research/briefings` | Read archive and saved summaries; never collect or generate. Query: `cadence=daily|weekly`, `timezone=Africa/Harare`, `scope=global|SUPPORTED_PAIR`, optional ISO `anchor`, `count=1..14`. Returns period windows, evidence, frozen saved summaries, OpenAI configuration status (no key), and feed coverage. |
| POST `/api/research/briefings/collect` | Public feed collection, upsert by source URL, feed health checks. Rapid duplicate collection requests reuse the recent result for 60 seconds. |
| POST `/api/research/briefings/generate` | JSON: `cadence`, ISO `period_start`, `timezone`, `scope`, `allow_paid:true`. Reuses an unchanged saved version before considering a paid call. Requires dated news or opinion, non-future period and explicit consent. |

Generate failures: 403 missing paid consent; 409 empty/scheduled-only or future period; 422 invalid request or model refusal; 429 provider rate/quota limit; 503 missing key or denied provider access; 502 invalid, incomplete, uncited or failed provider response. Failed responses are not saved; no automatic paid retry occurs.

OpenAI: server-side POST `https://api.openai.com/v1/responses`, `store:false`, strict JSON schema, maximum 6,000 output tokens, 100-second HTTP timeout. At most 48 evidence items, 8 per publisher. The model has no browsing or execution tools. Citation identifiers, analyst-source types and supported scenario pairs are validated before saving. A valid citation does not independently verify the model's interpretation.

SQLite tables are created at backend startup: `briefingarticle`, `briefingrun`, `feedcheck`. The archive is separate from canvas layout exports. Back up the local database separately; do not distribute it with source patches. There is no scheduled ingestion: history grows on explicit source refreshes and is limited to each feed's available backlog. Undated news is excluded; future news is excluded; future calendar events are explicitly scheduled, with unknown outcomes. Current-week summaries are partial and cannot use later news.

## Verification

- **32 backend tests passed**, including archive deduplication, known-date preservation, date/week/DST boundaries, scope filtering, future-news exclusion, scheduled-event inclusion, real zero calendar values, explicit paid consent, cache reuse, frozen citations, changed-evidence detection, missing-key behavior, OpenAI request contract, rate limits, incomplete responses and invalid citations. Fixtures use an isolated SQLite database and mocked OpenAI transport; no paid calls.
- **8 frontend behavioral tests passed**, including calendar-day/week labels across month/year/leap boundaries, plus existing ledger/cache/scenario tests.
- TypeScript/Vite build and targeted briefing ESLint passed. Existing large-bundle warning remains (~1.925 MB main JavaScript before gzip).
- Real browser: added desk/widget; explicit free collection; daily/weekly grouping; Today/This week/Last week; selected-day persistence after reload; pair scope; analyst-opinion filtering; native date keyboard navigation; future scheduled window; missing-key disabled generation. Live AI summary rendering/quality is **not verified without a key**.
- Live collection returned **296 archived items**: Fed 15, ECB 15, FXStreet News 30, FXStreet Analysis 30, BBC Business 57, CNBC Economy 30, calendar 119. URL deduplication can make totals differ from feed counts. In Africa/Harare, this week (Nov 9–15) held 116 items; last week 20. These counts change as feeds change. Source times were shown in the browser; latest available news included Nov 15, FXStreet opinions Nov 13, Fed Nov 12 and ECB Nov 13.
- Installed Postman executable is its desktop Snap, not the engineering CLI; tests used Python/httpx, Node and the real browser. No Postman simulation run is claimed.

## Source changes

Backend: `briefing.py`, `briefing_ai.py`, `briefing_models.py`, `briefing_sources.py`, router registration in `main.py`, `tests/test_briefings.py`.
Frontend: `Briefing.tsx`, `briefingService.ts`, `briefingMath.ts`, widget type/default/sidebar/renderer registration, research-desk placement, `tests/research.test.mjs`.
No dependencies were added. Existing modified COT widget, credentials and other dashboards were preserved. Integration backups are at `/run/media/administrator/storage/aurthurm/fx/briefing-backup-20261115/`.
