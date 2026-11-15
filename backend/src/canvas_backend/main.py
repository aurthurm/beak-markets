from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from typing import List

from canvas_backend.database import create_db_and_tables, get_session
from canvas_backend.models import PriceBar
from canvas_backend.fetchers import fetch_and_cache_ohlcv
from canvas_backend.research import router as research_router
from canvas_backend.fundamentals import router as fundamentals_router

from canvas_backend.briefing import router as briefing_router

app = FastAPI(title="Canvas Trader Backend")
app.include_router(research_router)
app.include_router(briefing_router)
app.include_router(fundamentals_router)

# We want the React canvas-trader app to be able to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/")
def read_root():
    return {"status": "ok", "app": "Canvas Trader Backend"}


@app.get("/api/market/history", response_model=List[PriceBar])
def get_history(
    ticker: str,
    days: int = Query(252, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    """Get OHLCV history for a ticker. Fetches and caches if missing."""
    bars = fetch_and_cache_ohlcv(session, ticker, days)
    return bars


@app.get("/api/market/dataset")
def get_dataset(
    ticker: str,
    days: int = Query(252, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    """Get complete market dataset including history and computed metrics."""
    try:
        bars = fetch_and_cache_ohlcv(session, ticker, days)
        if not bars:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")

        bars_dict = [
            {
                "ticker": b.ticker,
                "timestamp": b.timestamp,
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in bars
        ]
        return {
            "ticker": ticker, "name": ticker, "prices": bars_dict,
            "source": "Yahoo GC=F gold futures proxy" if ticker == "XAU/USD" else "Yahoo daily OHLC",
            "frequency": "daily", "as_of": bars_dict[-1]["timestamp"],
            "dataStatus": {"prices": "provider", "financials": "use /api/research/macro", "sentiment": "unavailable", "cot": "use /api/research/cot", "yields": "use /api/research/yields"},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
