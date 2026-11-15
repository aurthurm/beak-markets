import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pandas as pd
from sqlmodel import SQLModel, Session, create_engine

from canvas_backend.main import app
from canvas_backend import fetchers, research
from canvas_backend.models import PriceBar
from canvas_backend.calendar_provider import _parse_ts
from canvas_backend.research_math import scan_sweeps, surprise


class MathTests(unittest.TestCase):
    def test_surprise_units(self):
        self.assertEqual(surprise("190K", "0.2M"), -10000)
        self.assertEqual(surprise("3.2%", "3.0%"), 0.2)
        self.assertIsNone(surprise(None, "3%"))
        self.assertIsNone(surprise("3%", "3"))

    def test_offset(self):
        self.assertEqual(
            _parse_ts("2026-11-13T08:30:00-05:00", ""),
            int(datetime(2026, 11, 13, 13, 30, tzinfo=timezone.utc).timestamp() * 1000),
        )
        with self.assertRaises(ValueError):
            _parse_ts("bad date", "")

    def test_scan_excludes_today_and_detects_rejection(self):
        now = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        rows = [
            dict(
                timestamp=int((now - timedelta(days=10 - i)).timestamp() * 1000),
                open=10,
                high=11,
                low=9,
                close=10,
            )
            for i in range(10)
        ]
        rows[-1].update(high=12, low=8)
        rows.append(
            dict(
                timestamp=int(now.timestamp() * 1000), open=10, high=99, low=1, close=10
            )
        )
        result = scan_sweeps(rows, 5, now)
        self.assertEqual(result["bars_used"], 10)
        self.assertEqual({s["side"] for s in result["signals"]}, {"high", "low"})
        self.assertTrue(all(s["outcome"] == "rejection" for s in result["signals"]))

    def test_feed_missing_dates_and_unsafe_links(self):
        xml = b"<rss><channel><item><title>Policy</title><link>https://example.org/policy</link></item><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>"
        rows = research.parse_feed(xml, "USD", "Fed")
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["published_at"])


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        research._cache.clear()
        research._locks.clear()
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_calendar_unavailable_no_fake_data(self):
        with patch.object(
            research.calendar_provider,
            "fetch_calendar",
            new=AsyncMock(return_value=None),
        ):
            response = await self.client.get("/api/research/calendar")
        self.assertEqual(response.status_code, 503)

    async def test_calendar_actual_missing_preserved(self):
        with patch.object(
            research.calendar_provider,
            "fetch_calendar",
            new=AsyncMock(return_value=[{"id": "a", "actual": None, "forecast": "3%"}]),
        ):
            response = await self.client.get("/api/research/calendar")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["events"][0]["surprise"])

    async def test_scan_validation_and_unavailable(self):
        response = await self.client.get("/api/research/liquidity?lookback=0")
        self.assertEqual(response.status_code, 422)
        with patch(
            "canvas_backend.research.asyncio.to_thread", new=AsyncMock(return_value=[])
        ):
            response = await self.client.get("/api/research/liquidity")
        self.assertEqual(response.status_code, 503)

    async def test_board_without_optional_analysis_service(self):
        with patch.dict(os.environ, {"ANALYSIS_API_URL": ""}):
            response = await self.client.get("/api/research/board")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["rows"]), 8)
        self.assertTrue(all(row["analysis"] is None for row in response.json()["rows"]))

    async def test_price_404_not_swallowed_as_500(self):
        from canvas_backend.main import get_dataset
        from fastapi import HTTPException

        with patch("canvas_backend.main.fetch_and_cache_ohlcv", return_value=[]):
            with self.assertRaises(HTTPException) as error:
                get_dataset("EUR/USD", days=252, session=None)
        self.assertEqual(error.exception.status_code, 404)


class PriceTests(unittest.TestCase):
    def test_gold_mapping_history_limit_and_valid_cache(self):
        engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(engine)
        frame = pd.DataFrame(
            {
                "Open": [10.0, 11.0],
                "High": [12.0, 13.0],
                "Low": [9.0, 10.0],
                "Close": [11.0, 12.0],
                "Volume": [0.0, 0.0],
            },
            index=pd.to_datetime(["2026-11-11", "2026-11-12"], utc=True),
        )
        provider = MagicMock()
        provider.history.return_value = frame
        fetchers._fetched_at.clear()
        with (
            Session(engine) as session,
            patch.object(fetchers.yf, "Ticker", return_value=provider) as ticker,
        ):
            rows = fetchers.fetch_and_cache_ohlcv(session, "XAU/USD", 1)
            ticker.assert_called_once_with("GC=F")
            self.assertEqual(len(rows), 1)
            fetchers.fetch_and_cache_ohlcv(session, "XAU/USD", 1)
            self.assertEqual(provider.history.call_count, 1)
            self.assertEqual(
                session.exec(__import__("sqlmodel").select(PriceBar)).all().__len__(), 2
            )


class CacheRegressionTests(unittest.TestCase):
    def test_short_refresh_preserves_long_history_and_normalizes_session_dates(self):
        engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(engine)
        dates = pd.date_range("2026-01-01", periods=260, tz="Europe/London")
        frame = pd.DataFrame({'Open':1.0,'High':1.2,'Low':0.9,'Close':1.1,'Volume':0}, index=dates)
        provider=MagicMock()
        provider.history.side_effect=[frame,frame.iloc[-2:]]
        fetchers._fetched_at.clear();fetchers._history_depth.clear()
        with Session(engine) as session, patch.object(fetchers.yf,'Ticker',return_value=provider):
            first=fetchers.fetch_and_cache_ohlcv(session,'EUR/USD',365)
            self.assertTrue(all(row.timestamp % 86_400_000 == 0 for row in first))
            fetchers.fetch_and_cache_ohlcv(session,'EUR/USD',365)
            self.assertEqual(provider.history.call_count,1)
            fetchers._fetched_at.clear()
            fetchers.fetch_and_cache_ohlcv(session,'EUR/USD',2)
            self.assertEqual(len(session.exec(__import__('sqlmodel').select(PriceBar)).all()),260)

    def test_provider_failure_does_not_destroy_existing_cache(self):
        engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(engine)
        provider=MagicMock();provider.history.side_effect=RuntimeError('Upstream unavailable')
        fetchers._fetched_at.clear()
        with Session(engine) as session, patch.object(fetchers.yf,'Ticker',return_value=provider):
            session.add(PriceBar(ticker='EUR/USD',timestamp=1,open=1,high=2,low=1,close=1,volume=0));session.commit()
            self.assertEqual(fetchers.fetch_and_cache_ohlcv(session,'EUR/USD',252),[])
            self.assertEqual(len(session.exec(__import__('sqlmodel').select(PriceBar)).all()),1)


if __name__ == "__main__":
    unittest.main()
