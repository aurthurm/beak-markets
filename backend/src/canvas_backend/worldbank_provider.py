"""Annual World Bank observations. Bounded parallel requests preserve partial provider coverage."""
from __future__ import annotations

import math
import asyncio
import httpx

_BASE = "https://api.worldbank.org/v2"
_INDICATORS = {
    "gdp_growth": "NY.GDP.MKTP.KD.ZG",
    "cpi": "FP.CPI.TOTL.ZG",
    "unemployment": "SL.UEM.TOTL.ZS",
    "current_account": "BN.CAB.XOKA.GD.ZS",
}


def parse_macro(payload, country):
    if not isinstance(payload, list) or len(payload) != 2 or not isinstance(payload[1], list):
        return None
    named = {key: [] for key in _INDICATORS}
    reverse = {value: key for key, value in _INDICATORS.items()}
    for record in payload[1]:
        try:
            key = reverse[record["indicator"]["id"]]
            year, value = int(record["date"]), float(record["value"])
            if not math.isfinite(value):
                continue
            named[key].append({"year": year, "value": round(value, 4)})
        except (TypeError, ValueError, KeyError):
            continue
    for values in named.values():
        values.sort(key=lambda row: row["year"], reverse=True)
    if not any(named.values()):
        return None
    metadata = payload[0] if isinstance(payload[0], dict) else {}
    return {"country": country, "frequency": "annual", "source_updated": metadata.get("lastupdated"), **named}


async def fetch_macro(iso2: str) -> dict | None:
    # Short annual histories keep these public queries small. Each indicator may fail independently.
    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
        async def one(indicator):
            try:
                response = await client.get(
                    f"{_BASE}/country/{iso2}/indicator/{indicator}",
                    params={"format": "json", "per_page": "2", "mrv": "2"},
                )
                response.raise_for_status()
                payload = response.json()
                return payload[1] if isinstance(payload, list) and len(payload) == 2 and isinstance(payload[1], list) else []
            except (httpx.HTTPError, ValueError):
                return []
        results = await asyncio.gather(*(one(indicator) for indicator in _INDICATORS.values()))
    return parse_macro([{}, [row for rows in results for row in rows]], iso2)
