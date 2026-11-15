"""Persistent evidence and validated, cited macro briefings."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field as SchemaField
from sqlmodel import SQLModel, Field


class BriefingArticle(SQLModel, table=True):
    id: str = Field(primary_key=True)
    url: str
    headline: str
    excerpt: str
    source: str
    kind: str
    published_at: int | None = Field(default=None, index=True)
    first_seen_at: int
    last_seen_at: int
    currencies: str = ""


class BriefingRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    period_key: str = Field(index=True)
    generated_at: int
    fingerprint: str
    model: str
    summary_json: str
    sources_json: str


class FeedCheck(SQLModel, table=True):
    id: str = Field(primary_key=True)
    source: str
    url: str
    status: str
    checked_at: int
    item_count: int


class CitedPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = SchemaField(min_length=1, max_length=900)
    source_ids: list[str] = SchemaField(min_length=1, max_length=8)


class TradeScenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pair: str
    direction: Literal["conditional_long", "conditional_short", "watch_only"]
    thesis: str = SchemaField(min_length=1, max_length=700)
    catalyst: str = SchemaField(min_length=1, max_length=500)
    confirmation: str = SchemaField(min_length=1, max_length=500)
    invalidation: str = SchemaField(min_length=1, max_length=500)
    risks: str = SchemaField(min_length=1, max_length=600)
    source_ids: list[str] = SchemaField(min_length=1, max_length=8)


class MacroBriefing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    headline: str = SchemaField(min_length=1, max_length=180)
    overview: CitedPoint
    risk_tone: Literal["risk_on", "risk_off", "mixed", "insufficient_evidence"]
    sentiment_reason: CitedPoint
    macro_drivers: list[CitedPoint] = SchemaField(max_length=6)
    analyst_views: list[CitedPoint] = SchemaField(max_length=4)
    counterarguments: list[CitedPoint] = SchemaField(max_length=4)
    watch_next: list[CitedPoint] = SchemaField(max_length=5)
    trade_scenarios: list[TradeScenario] = SchemaField(max_length=3)
    coverage_limits: str = SchemaField(min_length=1, max_length=1000)


class GenerateBriefing(BaseModel):
    cadence: Literal["daily", "weekly"]
    period_start: str
    timezone: str = "Africa/Harare"
    scope: str = "global"
    allow_paid: bool = False
