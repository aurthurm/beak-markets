# Canvas Trader backend

FastAPI/SQLModel/SQLite service for provider-backed price data, macro research, daily liquidity scans and optional OpenAI macro briefings.

Requires Python 3.14+ and uv. From this directory:

```sh
uv sync --locked
uv run uvicorn canvas_backend.main:app --app-dir src --host 127.0.0.1 --port 8001
```

Docs: http://127.0.0.1:8001/docs. SQLite tables are created automatically at startup in the local `market_data.db`; the database is ignored by git. Run the React frontend separately from the repository root on port 5173.

Optional environment variables, set before starting the backend:

- `OPENAI_API_KEY`: enable explicitly requested paid briefings; never set this in frontend/Vite variables.
- `BRIEFING_AI_MODEL`: override the default OpenAI model.
- `FRED_API_KEY`: optional official FRED API access when public CSV is unavailable.
- `ANALYSIS_API_URL`: optional existing saved-analysis service.

No `.env` file is automatically loaded by this service. No credentials are needed for the public price and news feeds, subject to provider availability. FRED/CFTC may be unavailable or rate-limited. Research widgets show missing values and observation dates instead of fabricated observations.

Tests use isolated fixtures and make no paid AI calls:

```sh
PYTHONPATH=src uv run python -m unittest discover -s tests -p 'test_*.py'
```

Optional real provider check:

```sh
uv run python tests/live_smoke.py --output /tmp/live-provider-check.json
```
