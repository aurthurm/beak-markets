"""Deterministic research calculations. No LLM calls or synthetic market data."""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone


def number_with_unit(value: str | None) -> tuple[float, str] | None:
    if not value:
        return None
    match = re.fullmatch(r"\s*([+-]?[\d,]+(?:\.\d+)?)\s*([KMB%]?)\s*", value, re.I)
    if not match:
        return None
    number = float(match[1].replace(",", ""))
    unit = match[2].upper()
    return number * {"K": 1e3, "M": 1e6, "B": 1e9}.get(
        unit, 1
    ), "%" if unit == "%" else "number"


def surprise(actual: str | None, forecast: str | None) -> float | None:
    """Raw actual-minus-consensus, not a directional FX signal or z-score."""
    a, f = number_with_unit(actual), number_with_unit(forecast)
    if a is None or f is None or a[1] != f[1]:
        return None
    return round(a[0] - f[0], 6)


def scan_sweeps(
    raw: list[dict], lookback: int = 20, now: datetime | None = None
) -> dict:
    """Compare each completed daily candle against *preceding* lookback candles.

    Discard today's daily row conservatively: Stooq does not give a session-close
    timestamp. A breach plus a close inside is a price pattern, not proof of stops.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = int(
        now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
    )
    by_ts: dict[int, dict] = {}
    for b in raw:
        try:
            ts = int(b["timestamp"])
            o, h, lo, c = [float(b[k]) for k in ("open", "high", "low", "close")]
            if ts >= cutoff or not all(
                math.isfinite(v) and v > 0 for v in (o, h, lo, c)
            ):
                continue
            if lo > min(o, c) or h < max(o, c):
                continue
            by_ts[ts] = dict(timestamp=ts, open=o, high=h, low=lo, close=c)
        except KeyError, TypeError, ValueError, OverflowError:
            continue
    bars = sorted(by_ts.values(), key=lambda b: b["timestamp"])
    signals = []
    for i in range(lookback, len(bars)):
        b = bars[i]
        prior = bars[i - lookback : i]
        high, low = max(p["high"] for p in prior), min(p["low"] for p in prior)
        for side, level, breached, rejected in (
            ("high", high, b["high"] > high, b["close"] < high),
            ("low", low, b["low"] < low, b["close"] > low),
        ):
            if breached:
                signals.append(
                    {
                        "timestamp": b["timestamp"],
                        "side": side,
                        "level": level,
                        "close": b["close"],
                        "outcome": "rejection" if rejected else "breakout",
                    }
                )
    return {
        "bars_used": len(bars),
        "as_of": bars[-1]["timestamp"] if bars else None,
        "lookback": lookback,
        "signals": list(reversed(signals[-30:])),
    }
