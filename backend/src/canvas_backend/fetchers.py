import yfinance as yf
import time
import math
from datetime import datetime, timezone
from threading import Lock

from sqlmodel import Session, select
from canvas_backend.models import PriceBar

_fetched_at: dict[str, float] = {}
_fetch_locks: dict[str, Lock] = {}
_history_depth: dict[str, int] = {}


def fetch_and_cache_ohlcv(
    session: Session, ticker: str, days: int = 252
) -> list[PriceBar]:
    with _fetch_locks.setdefault(ticker, Lock()):
        return _fetch(session, ticker, days)


def _fetch(session: Session, ticker: str, days: int) -> list[PriceBar]:
    statement = (
        select(PriceBar)
        .where(PriceBar.ticker == ticker)
        .order_by(PriceBar.timestamp.asc())
    )
    existing_bars = session.exec(statement).all()

    # Refresh provider data hourly; honour the requested history length.
    if (
        existing_bars
        and (len(existing_bars) >= days or _history_depth.get(ticker, 0) >= days)
        and time.monotonic() - _fetched_at.get(ticker, -1e12) < 3600
    ):
        return list(existing_bars[-days:])

    # Map CanvasTrader forex names to yfinance symbols
    yf_ticker = ticker
    if ticker == "XAU/USD":
        yf_ticker = "GC=F"
    elif "/" in ticker:
        yf_ticker = ticker.replace("/", "") + "=X"
    elif ticker == "DXY":
        yf_ticker = "DX-Y.NYB"

    print(f"Fetching real data from yfinance for {ticker} ({yf_ticker})...")
    t = yf.Ticker(yf_ticker)
    try:
        df = t.history(period="5y" if days > 252 else "1y", timeout=15)
    except Exception:
        # Keep the persisted cache intact, but do not silently call stale prices current.
        return []

    new_bars = []

    if df.empty:
        print(f"WARNING: No data found for {yf_ticker}")
        return []

    required = ["Open", "High", "Low", "Close"]
    df = df.dropna(subset=required)
    if df.empty:
        return []

    for date, row in df.iterrows():
        session_date = date.date()
        ts = int(datetime(session_date.year, session_date.month, session_date.day, tzinfo=timezone.utc).timestamp() * 1000)
        o = float(row["Open"])
        h = float(row["High"])
        low = float(row["Low"])
        c = float(row["Close"])
        v = float(row.get("Volume", 0) or 0)
        if not all(math.isfinite(value) and value > 0 for value in (o, h, low, c)):
            continue
        if h < max(o, c, low) or low > min(o, c, h):
            continue
        if not math.isfinite(v) or v < 0:
            v = 0.0

        bar = PriceBar(
            ticker=ticker, timestamp=ts, open=o, high=h, low=low, close=c, volume=v
        )
        new_bars.append(bar)

    if not new_bars:
        return []
    try:
        # Retain longer history when refreshing a shorter requested window.
        timestamps = {bar.timestamp for bar in new_bars}
        start, end = min(timestamps) - 43_200_000, max(timestamps) + 43_200_000
        for old_bar in existing_bars:
            if start <= old_bar.timestamp <= end and old_bar.timestamp not in timestamps:
                session.delete(old_bar)
        existing = {bar.timestamp: bar for bar in existing_bars}
        for new_bar in new_bars:
            old_bar = existing.get(new_bar.timestamp)
            if old_bar:
                for field in ("open", "high", "low", "close", "volume"):
                    setattr(old_bar, field, getattr(new_bar, field))
                session.add(old_bar)
            else:
                session.add(new_bar)
        session.commit()
    except Exception:
        session.rollback()
        raise

    _fetched_at[ticker] = time.monotonic()
    _history_depth[ticker] = max(_history_depth.get(ticker, 0), 1000 if days > 252 else 252)
    return list(session.exec(statement).all()[-days:])
