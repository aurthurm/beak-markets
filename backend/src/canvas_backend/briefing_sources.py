"""Bounded RSS collection, reusing source URLs from markets-ai-analysis.

Only feed headlines and short excerpts are archived. Missing dates stay missing.
"""
import asyncio
import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urlparse

import httpx

FEEDS = (
    ("Federal Reserve", "official", "https://www.federalreserve.gov/feeds/press_monetary.xml"),
    ("European Central Bank", "official", "https://www.ecb.europa.eu/rss/press.html"),
    ("FXStreet News", "news", "https://www.fxstreet.com/rss/news"),
    ("FXStreet Analysis", "opinion", "https://www.fxstreet.com/rss/analysis"),
    ("BBC Business", "news", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("CNBC Economy", "news", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
)
KEYWORDS = {
    "USD": r"\b(usd|dollar|fed|fomc|us |u\.s\.|united states|treasury)\b",
    "EUR": r"\b(eur|euro|ecb|eurozone|european central bank|germany)\b",
    "GBP": r"\b(gbp|sterling|pound|boe|bank of england|uk |britain)\b",
    "JPY": r"\b(jpy|yen|boj|japan)\b", "CHF": r"\b(chf|franc|snb|swiss)\b",
    "AUD": r"\b(aud|aussie|rba|australia)\b", "CAD": r"\b(cad|loonie|boc|canada|oil)\b",
    "NZD": r"\b(nzd|kiwi|rbnz|new zealand)\b", "XAU": r"\b(gold|xau|bullion)\b",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]*>", " ", value))).strip()


def timestamp(value):
    if not value:
        return None
    try:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            return None
        return int(dt.timestamp() * 1000)
    except (TypeError, ValueError, OverflowError):
        return None


def parse_rss(content, source, kind, feed_url):
    root = ET.fromstring(content)
    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    rows = []
    for item in items[:80]:
        def value(*names):
            for name in names:
                found = item.find(name)
                if found is not None:
                    return "".join(found.itertext()).strip()
            return ""
        atom = "{http://www.w3.org/2005/Atom}"
        headline = clean_text(value("title", atom + "title"))[:350]
        url = value("link")
        if not url:
            for link in item.findall(atom + "link"):
                if link.get("rel", "alternate") == "alternate":
                    url = link.get("href", "")
                    break
        parsed = urlparse(url)
        if not headline or parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username:
            continue
        excerpt = clean_text(value("description", atom + "summary", atom + "content"))[:600]
        tags = [key for key, pattern in KEYWORDS.items() if re.search(pattern, headline + " " + excerpt, re.I)]
        if source == "Federal Reserve": tags = ["USD"]
        if source == "European Central Bank": tags = ["EUR"]
        rows.append({
            "id": hashlib.sha256(url.encode()).hexdigest()[:24], "url": url,
            "headline": headline, "excerpt": excerpt, "source": source, "kind": kind,
            "published_at": timestamp(value("pubDate", atom + "published", atom + "updated")),
            "currencies": ",".join(tags),
        })
    return rows


async def fetch_sources():
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "CanvasTrader/1.0 RSS research reader"}) as client:
        async def one(source, kind, url):
            try:
                response = await client.get(url)
                response.raise_for_status()
                rows = parse_rss(response.content, source, kind, url)
                return rows, {"source": source, "url": url, "status": "available" if rows else "empty", "item_count": len(rows)}
            except (httpx.HTTPError, ET.ParseError, ValueError):
                return [], {"source": source, "url": url, "status": "unavailable", "item_count": 0}
        return await asyncio.gather(*(one(*feed) for feed in FEEDS))
