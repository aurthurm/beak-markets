"""Research API for Canvas Trader. Reuses its backend; no paid scraper dependency."""

from __future__ import annotations

import asyncio
import hashlib
import os
import re
import time
import xml.etree.ElementTree as ET
from typing import Literal
from pydantic import BaseModel, Field, FiniteFloat
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session

from canvas_backend import calendar_provider
from canvas_backend.database import engine
from canvas_backend.fetchers import fetch_and_cache_ohlcv
from canvas_backend.research_math import scan_sweeps, surprise

router = APIRouter(prefix="/api/research", tags=["research"])
PAIRS = (
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",
    "EUR/GBP",
)
SUPPORTED = (*PAIRS, "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/CHF", "XAU/USD", "DXY")
_cache: dict[str, tuple[float, dict | None]] = {}
_locks: dict[str, asyncio.Lock] = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def cached(key, fetcher, ttl=300):
    async with _locks.setdefault(key, asyncio.Lock()):
        entry = _cache.get(key)
        if entry and entry[0] > time.monotonic():
            return entry[1]
        data = await fetcher()
        # Cache failures briefly to avoid hammering rate-limited providers.
        _cache[key] = (time.monotonic() + (ttl if data is not None else 30), data)
        return data


@router.get("/calendar")
async def calendar():
    async def fetch():
        events = await calendar_provider.fetch_calendar()
        return None if events is None else {"events": events, "fetched_at": now_iso()}

    data = await cached("calendar", fetch, ttl=3600)
    if data is None:
        raise HTTPException(
            503, "Calendar feed unavailable. No demo events are substituted."
        )
    return dict(
        data,
        source="ForexFactory calendar feed",
        source_url="https://www.forexfactory.com/calendar",
        note="Available calendar-feed weeks only; the next-week feed may be missing. Actuals may be absent. Surprise is not a currency-direction signal.",
        events=[
            dict(e, surprise=surprise(e.get("actual"), e.get("forecast")))
            for e in data["events"]
        ],
    )


def load_bars(ticker):
    # A new DB session belongs to the worker thread, never to the async caller.
    with Session(engine) as session:
        return [b.model_dump() for b in fetch_and_cache_ohlcv(session, ticker, 365)]


@router.get("/liquidity")
async def liquidity(ticker: str = "EUR/USD", lookback: int = Query(20, ge=5, le=60)):
    if ticker not in SUPPORTED:
        raise HTTPException(404, "Unsupported ticker")
    bars = await asyncio.to_thread(load_bars, ticker)
    if not bars:
        raise HTTPException(
            503, "Price feed unavailable. No simulated prices are used."
        )
    scan = scan_sweeps(bars, lookback)
    return dict(
        scan,
        ticker=ticker,
        source="Yahoo gold futures proxy (GC=F) / SQLite cache"
        if ticker == "XAU/USD"
        else "Yahoo daily OHLC / SQLite cache",
        source_url="https://finance.yahoo.com",
        fetched_at=now_iso(),
        status="available" if scan["bars_used"] > lookback else "insufficient",
        note="Completed daily candles only. Breaches and rejections do not prove stop placement or institutional intent.",
    )


class SourceClaim(BaseModel):
    claim: str
    source: str = ""
    source_url: str = ""


class SavedAnalysis(BaseModel):
    stance: Literal["bullish", "bearish", "neutral"]
    confidence: FiniteFloat = Field(ge=0, le=1)
    headline: str
    divergence_notes: str = ""
    article_count: int = Field(ge=0)
    generated_at: datetime
    drivers: list[SourceClaim] = Field(default_factory=list)
    counterpoints: list[SourceClaim] = Field(default_factory=list)


@router.get("/board")
async def board():
    # Optional integration; Canvas Trader remains usable without the analysis app.
    upstream = os.getenv("ANALYSIS_API_URL", "").rstrip("/")

    async def one(client, pair):
        if not upstream:
            return dict(ticker=pair, status="missing", analysis=None)
        try:
            response = await client.get(
                f"{upstream}/analyze/{pair.replace('/', '')}/latest"
            )
            response.raise_for_status()
            payload = response.json()
            if not payload:
                return dict(ticker=pair, status="missing", analysis=None)
            analysis = SavedAnalysis.model_validate(payload).model_dump(mode="json")
            if (
                not analysis
                or not analysis.get("article_count")
                or not analysis.get("drivers")
            ):
                return dict(ticker=pair, status="missing", analysis=None)
            generated = datetime.fromisoformat(
                analysis["generated_at"].replace("Z", "+00:00")
            )
            if generated.tzinfo is None:
                generated = generated.replace(tzinfo=timezone.utc)
            stale = datetime.now(timezone.utc) - generated > timedelta(hours=24)
            return dict(
                ticker=pair, status="stale" if stale else "available", analysis=analysis
            )
        except httpx.HTTPError, ValueError, KeyError, TypeError:
            return dict(ticker=pair, status="unavailable", analysis=None)

    async with httpx.AsyncClient(timeout=10) as client:
        rows = await asyncio.gather(*(one(client, pair) for pair in PAIRS))
    rows.sort(
        key=lambda r: (
            r["status"] != "available",
            -(r["analysis"].get("confidence", 0) if r["analysis"] else -1),
        )
    )
    return dict(
        rows=rows,
        checked_at=now_iso(),
        source="Saved macro analyses"
        if upstream
        else "Macro analysis service not connected",
    )


FEEDS = (
    (
        "USD",
        "Federal Reserve",
        "https://www.federalreserve.gov/feeds/press_monetary.xml",
    ),
    ("EUR", "European Central Bank", "https://www.ecb.europa.eu/rss/press.html"),
)


def parse_feed(content, currency, source):
    root = ET.fromstring(content)
    articles = []
    for item in root.findall(".//item"):
        title, url, date = (
            item.findtext("title"),
            item.findtext("link"),
            item.findtext("pubDate"),
        )
        if not title or not url or not url.startswith(("https://", "http://")):
            continue
        try:
            published = parsedate_to_datetime(date).isoformat() if date else None
        except ValueError, TypeError:
            published = None
        articles.append(
            dict(
                id=hashlib.sha256(url.encode()).hexdigest()[:20],
                headline=unescape(title).strip(),
                url=url,
                source=source,
                currency=currency,
                published_at=published,
                summary=unescape(re.sub(
                    r"<[^>]*>", " ", item.findtext("description") or ""
                ).strip())[:1200],
            )
        )
    return articles


@router.get("/news")
async def news(ticker: str = "EUR/USD"):
    if ticker not in SUPPORTED:
        raise HTTPException(404, "Unsupported ticker")
    currencies = ["USD"] if ticker == "DXY" else ticker.split("/")
    selected = [f for f in FEEDS if f[0] in currencies]
    articles, failed = [], []
    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
        for currency, source, url in selected:

            async def fetch(url=url, currency=currency, source=source):
                response = await client.get(url)
                response.raise_for_status()
                return dict(
                    articles=parse_feed(response.content, currency, source),
                    fetched_at=now_iso(),
                )

            try:
                data = await cached(url, fetch)
                articles.extend(data["articles"])
            except httpx.HTTPError, ET.ParseError:
                failed.append(source)
    if selected and len(failed) == len(selected):
        raise HTTPException(
            503,
            "News sources unavailable. Retry later; no invented headlines are shown.",
        )
    unique = {a["url"]: a for a in articles}
    items = sorted(
        unique.values(), key=lambda a: a["published_at"] or "", reverse=True
    )[:40]
    return dict(
        articles=items,
        source="Official central-bank RSS feeds",
        fetched_at=now_iso(),
        warnings=failed,
        note="Coverage currently includes Fed and ECB announcements only. No automatic sentiment or impact is inferred.",
    )
