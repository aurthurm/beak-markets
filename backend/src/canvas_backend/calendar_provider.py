"""Fetch the economic calendar from ForexFactory's unofficial JSON feed.

The feed is published by a third party (nfs.faireconomy.media) that mirrors
ForexFactory's calendar.  It covers the current week and next week.

No API key required.  Falls back to None (stub) if unreachable.

Response shape per event:
  { title, country, date, time, impact, forecast, previous, actual }
"""

from __future__ import annotations

import logging
import hashlib
from datetime import datetime, timezone

import httpx

log = logging.getLogger(__name__)

_URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
]
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; markets-ai-analysis/1.0; +https://github.com/beak-insights)"
}
_TIMEOUT = 12.0

_IMPACT = {"High": "high", "Medium": "medium", "Low": "low"}


def _parse_ts(date_str: str, time_str: str) -> int:
    """Preserve the feed's ISO offset; never turn malformed dates into 'now'."""
    if "T" in date_str:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            raise ValueError("ISO calendar timestamps must include an offset")
    else:
        time_str = (time_str or "").strip().lower()
        if ":" in time_str and ("am" in time_str or "pm" in time_str):
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M%p")
        else:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        # Legacy fixtures use UTC; current live feeds include explicit offsets.
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


async def fetch_calendar() -> list[dict] | None:
    """Return EconomicEvent-shaped dicts for this week + next week, or None."""
    raw: list[dict] = []
    async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT) as client:
        for url in _URLS:
            try:
                r = await client.get(url)
                r.raise_for_status()
                raw.extend(r.json())
            except Exception as exc:
                log.warning("ff_calendar_error url=%s error=%s", url, exc)

    if not raw:
        return None

    events: list[dict] = []
    seen: set[str] = set()
    for ev in raw:
        date_str = (ev.get("date") or "").strip()
        if not date_str:
            continue
        try:
            ts = _parse_ts(date_str, ev.get("time", ""))
            currency = (ev.get("country") or "").upper()
            title = ev.get("title", "").strip()
            if not currency or not title:
                continue
            event_id = hashlib.sha256(f"{currency}|{title}|{ts}".encode()).hexdigest()[
                :20
            ]
            if event_id in seen:
                continue
            seen.add(event_id)
            time_str = (ev.get("time") or "").lower()
            time_known = ("T" in date_str or ":" in time_str) and not any(
                text in time_str for text in ("tentative", "all day")
            )
            events.append(
                {
                    "id": f"ff-{event_id}",
                    "time_known": time_known,
                    "country": currency,
                    "title": title,
                    "timestamp": ts,
                    "impact": _IMPACT.get(ev.get("impact", "Low"), "low"),
                    "actual": ev.get("actual") or None,
                    "forecast": ev.get("forecast") or None,
                    "previous": ev.get("previous") or None,
                }
            )
        except Exception:
            continue

    if not events:
        return None

    events.sort(key=lambda e: e["timestamp"])
    log.info("ff_calendar_ok events=%d", len(events))
    return events
