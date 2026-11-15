"""Daily/weekly evidence archive and explicit, persisted OpenAI synthesis."""
import asyncio
import hashlib
import json
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone as utc_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session, select, func

from canvas_backend.database import engine
from canvas_backend.briefing_models import BriefingArticle, BriefingRun, FeedCheck, GenerateBriefing
from canvas_backend.briefing_sources import fetch_sources
from canvas_backend.briefing_ai import ai_config, call_openai
from canvas_backend.research import SUPPORTED, calendar

router = APIRouter(prefix="/api/research/briefings", tags=["macro briefings"])
_collect_lock = asyncio.Lock()
_generation_locks: dict[str, asyncio.Lock] = {}


def now_ms():
    return int(datetime.now(utc_timezone.utc).timestamp() * 1000)


def period_window(cadence, anchor, zone, now=None):
    try:
        tz = ZoneInfo(zone)
        start = date.fromisoformat(anchor)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, "Use an ISO date and a valid IANA timezone.") from None
    if cadence not in ("daily", "weekly"):
        raise HTTPException(422, "Cadence must be daily or weekly.")
    if cadence == "weekly":
        start -= timedelta(days=start.weekday())
    end = start + timedelta(days=7 if cadence == "weekly" else 1)
    first = int(datetime.combine(start, time.min, tzinfo=tz).timestamp() * 1000)
    last = int(datetime.combine(end, time.min, tzinfo=tz).timestamp() * 1000)
    current = now if now is not None else now_ms()
    return {"start": start.isoformat(), "end": end.isoformat(), "start_ms": first, "end_ms": last,
            "timezone": zone, "cadence": cadence, "as_of": current,
            "partial": first <= current < last, "future": current < first}


def validate_scope(scope):
    if scope != "global" and scope not in SUPPORTED:
        raise HTTPException(422, "Choose global or a supported FX pair.")


def period_key(period, scope):
    return f"{period['cadence']}:{period['start']}:{period['timezone']}:{scope}"


def source_dict(row):
    return {key: getattr(row, key) for key in ("id", "url", "headline", "excerpt", "source", "kind", "published_at", "currencies")}


def period_sources(session, period, scope):
    rows = session.exec(select(BriefingArticle).where(
        BriefingArticle.published_at >= period["start_ms"],
        BriefingArticle.published_at < period["end_ms"],
    ).order_by(BriefingArticle.published_at.desc(), BriefingArticle.id)).all()
    currencies = {"USD"} if scope == "DXY" else set(scope.split("/"))
    return [source_dict(row) for row in rows
            if (scope == "global" or currencies.intersection(row.currencies.split(",")))
            and (row.published_at <= period["as_of"] or row.kind == "economic_event")]


def fingerprint(rows):
    return hashlib.sha256(json.dumps(sorted(rows, key=lambda row: row["id"]), sort_keys=True).encode()).hexdigest()


def select_evidence(rows):
    # Keep a prolific feed from crowding all other perspectives out of the prompt.
    counts = Counter()
    selected = []
    for row in rows:
        if counts[row["source"]] >= 8:
            continue
        counts[row["source"]] += 1
        selected.append(row)
        if len(selected) == 48:
            break
    return selected


def latest_run(session, key):
    return session.exec(select(BriefingRun).where(BriefingRun.period_key == key)
                        .order_by(BriefingRun.id.desc()).limit(1)).first()


def saved_summary(row, current_fingerprint):
    if not row:
        return None
    return {"id": row.id, "generated_at": row.generated_at, "model": row.model,
            "sources_changed": row.fingerprint != current_fingerprint,
            "content": json.loads(row.summary_json), "sources": json.loads(row.sources_json)}


@router.get("")
def list_briefings(cadence: str = "weekly", timezone: str = "Africa/Harare", scope: str = "global",
                   anchor: str | None = None, count: int = Query(6, ge=1, le=14)):
    validate_scope(scope)
    try:
        local_today = datetime.now(ZoneInfo(timezone)).date()
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Use a valid IANA timezone.") from None
    current = period_window(cadence, anchor or local_today.isoformat(), timezone)
    step = 7 if cadence == "weekly" else 1
    periods = []
    with Session(engine) as session:
        for index in range(count):
            start = date.fromisoformat(current["start"]) - timedelta(days=step * index)
            period = period_window(cadence, start.isoformat(), timezone, current["as_of"])
            rows = period_sources(session, period, scope)
            run = latest_run(session, period_key(period, scope))
            periods.append({**period, "item_count": len(rows), "source_count": len({row['source'] for row in rows}),
                "kind_counts": dict(Counter(row["kind"] for row in rows)), "items": rows[:120],
                "summary": saved_summary(run, fingerprint(rows))})
        checks = session.exec(select(FeedCheck).order_by(FeedCheck.source)).all()
        undated = session.exec(select(func.count()).select_from(BriefingArticle).where(BriefingArticle.published_at.is_(None))).one()
        total = session.exec(select(func.count()).select_from(BriefingArticle)).one()
    return {"periods": periods, "ai": ai_config(), "scope": scope, "timezone": timezone,
            "local_today": local_today.isoformat(), "archive_count": total, "undated_count": undated,
            "feeds": [row.model_dump() for row in checks],
            "note": "Headlines and feed excerpts only. Coverage is a sample, not a complete historical news archive. Refresh sources to grow the archive. Missing publication dates are excluded from period summaries."}


def save_collection(results, now):
    added = 0
    with Session(engine) as session:
        for rows, check in results:
            for data in rows:
                existing = session.get(BriefingArticle, data["id"])
                if existing:
                    for key, value in data.items():
                        if key == "published_at" and value is None:
                            continue
                        setattr(existing, key, value)
                    existing.last_seen_at = now
                else:
                    existing = BriefingArticle(**data, first_seen_at=now, last_seen_at=now)
                    added += 1
                session.add(existing)
            key = hashlib.sha256(check["url"].encode()).hexdigest()[:24]
            existing_check = session.get(FeedCheck, key)
            if existing_check:
                for key, value in check.items(): setattr(existing_check, key, value)
                existing_check.checked_at = now
            else:
                existing_check = FeedCheck(id=key, checked_at=now, **check)
            session.add(existing_check)
        session.commit()
    return added


async def calendar_source():
    url = "https://www.forexfactory.com/calendar"
    try:
        feed = await calendar()
        rows = []
        def shown(value):
            return "unavailable" if value is None or value == "" else str(value)
        for event in feed["events"]:
            # Unknown release times do not become invented midnight observations.
            if not event.get("time_known"):
                continue
            rows.append({"id": event["id"], "url": url, "headline": event["country"] + " · " + event["title"],
                "excerpt": "Scheduled calendar event. Actual: " + shown(event.get("actual")) +
                "; Forecast: " + shown(event.get("forecast")) + "; Previous: " + shown(event.get("previous")),
                "source": "ForexFactory calendar", "kind": "economic_event", "published_at": event["timestamp"], "currencies": event["country"]})
        return rows, {"source": "ForexFactory calendar", "url": url, "status": "available", "item_count": len(rows)}
    except (HTTPException, KeyError, TypeError):
        return [], {"source": "ForexFactory calendar", "url": url, "status": "unavailable", "item_count": 0}


@router.post("/collect")
async def collect_sources():
    async with _collect_lock:
        # Coalesce duplicate widgets and rapid refresh clicks without paid requests.
        with Session(engine) as session:
            recent = session.exec(select(FeedCheck).order_by(FeedCheck.checked_at.desc()).limit(1)).first()
        if recent and now_ms() - recent.checked_at < 60_000:
            return {"added": 0, "reused_recent_collection": True}
        feeds, events = await asyncio.gather(fetch_sources(), calendar_source())
        added = await asyncio.to_thread(save_collection, [*feeds, events], now_ms())
        return {"added": added, "reused_recent_collection": False}


@router.post("/generate")
async def generate_briefing(request: GenerateBriefing):
    validate_scope(request.scope)
    period = period_window(request.cadence, request.period_start, request.timezone)
    if period["future"]:
        raise HTTPException(409, "Future periods cannot be summarized as completed news.")
    key = period_key(period, request.scope)
    async with _generation_locks.setdefault(key, asyncio.Lock()):
        with Session(engine) as session:
            rows = period_sources(session, period, request.scope)
            current = fingerprint(rows)
            previous = latest_run(session, key)
            if previous and previous.fingerprint == current:
                return {"summary": saved_summary(previous, current), "reused": True}
        if not any(row["kind"] != "economic_event" for row in rows):
            raise HTTPException(409, "No dated news or opinion is archived for this period. Refresh sources or choose another period.")
        if not request.allow_paid:
            raise HTTPException(403, "Confirm the paid OpenAI request before generating a briefing.")
        evidence = select_evidence(rows)
        summary, model = await call_openai(evidence, period, request.scope)
        run = BriefingRun(period_key=key, generated_at=now_ms(), fingerprint=current, model=model,
                          summary_json=summary.model_dump_json(), sources_json=json.dumps(evidence))
        with Session(engine) as session:
            session.add(run)
            session.commit()
            session.refresh(run)
            return {"summary": saved_summary(run, current), "reused": False}
