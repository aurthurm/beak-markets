"""Isolated fixtures: never call paid APIs or modify the application database."""
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from canvas_backend.main import app
from canvas_backend import briefing as b, briefing_ai as ai
from canvas_backend.briefing_models import BriefingArticle, BriefingRun, MacroBriefing
from canvas_backend.briefing_sources import parse_rss, timestamp


def content(source="a"):
    point = {"text": "Fixture evidence is limited.", "source_ids": [source]}
    return {"headline": "Fixture briefing", "overview": point, "risk_tone": "mixed",
            "sentiment_reason": point, "macro_drivers": [point], "analyst_views": [],
            "counterarguments": [], "watch_next": [], "trade_scenarios": [], "coverage_limits": "Test fixture only."}


def article(id="a", at=None, kind="news", currencies="USD"):
    return dict(id=id, url="https://example.org/"+id, headline="Dollar policy fixture", excerpt="Evidence",
                source="Fixture", kind=kind, published_at=at, currencies=currencies)


class PeriodTests(unittest.TestCase):
    def test_monday_year_boundary_and_dst(self):
        self.assertEqual(b.period_window("weekly", "2027-01-03", "Africa/Harare")["start"], "2026-12-28")
        day=b.period_window("daily", "2026-03-08", "America/New_York")
        self.assertEqual(day["end_ms"]-day["start_ms"], 23*3600*1000)
        for cadence, day, zone in [("monthly","2026-01-01","UTC"),("daily","bad","UTC"),("daily","2026-01-01","bad/zone")]:
            with self.assertRaises(HTTPException): b.period_window(cadence,day,zone)

    def test_rss_atom_dates_and_unsafe_links(self):
        xml=b'<rss><channel><item><title>Dollar</title><link>https://example.org/a</link><pubDate>Fri, 13 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Unknown date</title><link>https://example.org/b</link></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>'
        rows=parse_rss(xml,"Test","news","")
        self.assertEqual(len(rows),2); self.assertIsNotNone(rows[0]["published_at"]); self.assertIsNone(rows[1]["published_at"])
        atom=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Euro</title><link href="https://example.org/e"/><published>2026-11-13T14:00:00+02:00</published></entry></feed>'
        self.assertEqual(parse_rss(atom,"Test","news","")[0]["published_at"],rows[0]["published_at"])
        self.assertIsNone(timestamp("2026-11-13T12:00:00"))

    def test_citation_and_opinion_rules(self):
        sources=[article()]
        with self.assertRaises(ValueError): ai.validate_citations(MacroBriefing(**content("unknown")),sources)
        data=content(); data["analyst_views"]=[data["overview"]]
        with self.assertRaises(ValueError): ai.validate_citations(MacroBriefing(**data),sources)
        sources[0]["kind"]="opinion"
        ai.validate_citations(MacroBriefing(**data),sources)


class ArchiveTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.patch=patch.object(b,"engine",self.engine); self.patch.start()
        b._generation_locks.clear()
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url="http://test")
        self.period=b.period_window("daily","2026-11-13","UTC")
        self.at=self.period["start_ms"]+1000
        self.request=dict(cadence="daily",period_start="2026-11-13",timezone="UTC")
        self.check=dict(source="Fixture",url="https://example.org/rss",status="available",item_count=1)

    async def asyncTearDown(self):
        await self.client.aclose(); self.patch.stop(); self.engine.dispose()

    def add(self, rows, now=100):
        return b.save_collection([(rows,self.check)],now)

    async def test_dedup_preserves_first_seen_and_known_publication(self):
        self.assertEqual(self.add([article(at=self.at)]),1)
        self.assertEqual(self.add([article(at=None)],200),0)
        with Session(self.engine) as s:
            row=s.get(BriefingArticle,"a")
            self.assertEqual((row.first_seen_at,row.last_seen_at,row.published_at),(100,200,self.at))

    async def test_period_excludes_undated_and_future_news_but_keeps_scheduled_events(self):
        self.add([article(at=self.at),article("undated"),article("later",self.at+2000),article("event",self.at+2000,"economic_event"),article("yen",self.at,currencies="JPY")])
        with Session(self.engine) as s:
            rows=b.period_sources(s,{**self.period,"as_of":self.at+1000},"EUR/USD")
        self.assertEqual({row["id"] for row in rows},{"a","event"})

    async def test_calendar_zero_is_an_observation_not_missing(self):
        with patch.object(b,"calendar",new=AsyncMock(return_value={"events":[dict(id="event",country="USD",title="Fixture",time_known=True,timestamp=self.at,actual=0,forecast=0,previous=None)]})):
            rows,check=await b.calendar_source()
        self.assertIn("Actual: 0; Forecast: 0; Previous: unavailable",rows[0]["excerpt"])

    async def test_get_has_no_collection_or_generation_side_effect(self):
        with patch.object(b,"call_openai",new=AsyncMock()) as paid, patch.object(b,"fetch_sources",new=AsyncMock()) as fetch:
            response=await self.client.get("/api/research/briefings?cadence=daily&anchor=2026-11-13&timezone=UTC&count=1")
        self.assertEqual(response.status_code,200); self.assertEqual(response.json()["periods"][0]["item_count"],0)
        paid.assert_not_called(); fetch.assert_not_called()

    async def test_empty_consent_cache_and_changed_sources(self):
        with patch.object(b,"call_openai",new=AsyncMock(return_value=(MacroBriefing(**content()),"fixture-model"))) as paid:
            self.assertEqual((await self.client.post("/api/research/briefings/generate",json=self.request)).status_code,409)
            self.add([article(at=self.at)])
            self.assertEqual((await self.client.post("/api/research/briefings/generate",json=self.request)).status_code,403)
            paid.assert_not_called()
            first=await self.client.post("/api/research/briefings/generate",json={**self.request,"allow_paid":True})
            self.assertEqual(first.status_code,200); self.assertFalse(first.json()["reused"])
            again=await self.client.post("/api/research/briefings/generate",json=self.request)
            self.assertTrue(again.json()["reused"]); self.assertEqual(paid.await_count,1)
            self.add([article("b",self.at+1)])
            feed=await self.client.get("/api/research/briefings?cadence=daily&anchor=2026-11-13&timezone=UTC&count=1")
            saved=feed.json()["periods"][0]["summary"]
            self.assertTrue(saved["sources_changed"]); self.assertEqual([s["id"] for s in saved["sources"]],["a"])

    async def test_missing_key_and_failure_never_save(self):
        self.add([article(at=self.at)])
        with patch.dict(os.environ,{"OPENAI_API_KEY":""}):
            response=await self.client.post("/api/research/briefings/generate",json={**self.request,"allow_paid":True})
        self.assertEqual(response.status_code,503)
        with Session(self.engine) as s: self.assertEqual(s.exec(select(BriefingRun)).all(),[])


class OpenAIContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_structured_responses_contract_and_no_retry(self):
        calls=[]
        def handle(request):
            calls.append(request)
            return httpx.Response(200,json={"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":json.dumps(content())}]}]})
        real_client=httpx.AsyncClient
        with patch.dict(os.environ,{"OPENAI_API_KEY":"fixture-key"}), patch.object(ai.httpx,"AsyncClient",side_effect=lambda **kw:real_client(transport=httpx.MockTransport(handle),**kw)):
            summary,model=await ai.call_openai([article()],{},"global")
        self.assertEqual(summary.headline,"Fixture briefing"); self.assertEqual(len(calls),1)
        payload=json.loads(calls[0].content)
        self.assertEqual(calls[0].url.path,"/v1/responses"); self.assertFalse(payload["store"])
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertEqual(calls[0].headers["Authorization"],"Bearer fixture-key")

    async def test_rate_limit_invalid_citation_and_incomplete_response(self):
        real_client=httpx.AsyncClient
        cases=[(429,{},429),(200,{"status":"incomplete"},502),(200,{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":json.dumps(content("invalid"))}]}]},502)]
        for status,data,expected in cases:
            calls=[]
            def handle(request):
                calls.append(request); return httpx.Response(status,json=data)
            with patch.dict(os.environ,{"OPENAI_API_KEY":"fixture-key"}), patch.object(ai.httpx,"AsyncClient",side_effect=lambda **kw:real_client(transport=httpx.MockTransport(handle),**kw)):
                with self.assertRaises(HTTPException) as error: await ai.call_openai([article()],{},"global")
            self.assertEqual(error.exception.status_code,expected); self.assertEqual(len(calls),1)
