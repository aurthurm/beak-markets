import random
import time

def generate_dataset(ticker: str, prices: list) -> dict:
    seed_str = ticker
    seed_val = sum(ord(c) for c in seed_str) * 137
    random.seed(seed_val)

    now = int(time.time() * 1000)
    day_ms = 86400000

    financials = {
        "revenue": [round(1 + i * 0.3 + random.random() * 2, 2) for i in range(8)],
        "eps": [round(0.5 + random.random() * 5, 2) for i in range(8)],
        "debt": round(random.random() * 120, 1),
        "margins": round(random.random() * 6 - 1, 1),
        "peRatio": round(random.random() * 8, 1),
        "pegRatio": round(-2 + random.random() * 6, 2),
        "dcfEstimate": 0
    }

    six_weeks_ms = 42 * 86400000
    earningsDates = [now + (i + 1) * six_weeks_ms - int(random.random() * 5 * 86400000) for i in range(4)]

    news = []
    headline_pool = [
        "Market Volatility Increases Ahead of Key Data",
        f"Analysts Revise Outlook for {ticker}",
        "Central Bank Policy Shifts Focus",
        "Economic Indicators Point to Mixed Recovery",
        f"{ticker} Breaks Key Resistance Level",
        "Investors Weigh Geopolitical Risks",
        f"Strong Momentum Seen in {ticker} Trading",
        "Inflation Concerns Persist in Markets"
    ]
    sentiments = ['bullish', 'bearish', 'neutral']
    impacts = ['high', 'medium', 'low']
    sources = ['Reuters', 'Bloomberg', 'FX Street', 'ForexLive', 'DailyFX']

    for i in range(12):
        sentiment = random.choice(sentiments)
        news.append({
            "id": f"{ticker}-news-{i}",
            "ticker": ticker,
            "headline": random.choice(headline_pool),
            "source": random.choice(sources),
            "timestamp": now - int(random.random() * 14 * day_ms) - int(random.random() * 12 * 3600000),
            "sentiment": sentiment,
            "impact": random.choice(impacts),
            "summary": f"Market analysis suggests {sentiment} outlook for {ticker}."
        })

    news.sort(key=lambda x: x["timestamp"], reverse=True)

    overall = int((random.random() - 0.4) * 120)
    sentiment_data = {
        "ticker": ticker,
        "overall": max(-100, min(100, overall)),
        "breakdown": [
            {"label": "Technical", "value": max(-100, min(100, int((random.random() - 0.4) * 140)))},
            {"label": "Fundamental", "value": max(-100, min(100, int((random.random() - 0.45) * 130)))},
            {"label": "Positioning", "value": max(-100, min(100, int((random.random() - 0.5) * 120)))},
            {"label": "Flow", "value": max(-100, min(100, int((random.random() - 0.4) * 110)))},
            {"label": "Retail Sentiment", "value": max(-100, min(100, int((random.random() - 0.55) * 150)))}
        ],
        "signals": [
            {"label": "Moving Avg Cross", "direction": "bullish" if random.random() > 0.5 else "bearish", "strength": int(40 + random.random() * 60)},
            {"label": "RSI Divergence", "direction": "bullish" if random.random() > 0.6 else ("bearish" if random.random() > 0.3 else "neutral"), "strength": int(30 + random.random() * 70)},
            {"label": "MACD Signal", "direction": "bullish" if random.random() > 0.45 else "bearish", "strength": int(50 + random.random() * 50)},
            {"label": "COT Report", "direction": "bullish" if random.random() > 0.5 else ("bearish" if random.random() > 0.3 else "neutral"), "strength": int(20 + random.random() * 80)}
        ],
        "history": [
            {"timestamp": now - (30 - i) * day_ms, "value": max(-100, min(100, overall + int((random.random() - 0.5) * 40)))}
            for i in range(30)
        ]
    }

    scale = 50000 + random.random() * 150000
    def gen_cot_pos(scale_f):
        long = int(scale_f * (0.3 + random.random() * 0.5))
        short = int(scale_f * (0.3 + random.random() * 0.5))
        return {"long": long, "short": short, "net": long - short, "change": int((random.random() - 0.5) * scale_f * 0.15)}

    commercial = gen_cot_pos(scale * 0.6)
    nonCommercial = gen_cot_pos(scale * 0.5)
    nonReportable = gen_cot_pos(scale * 0.15)

    week_ms = 7 * 86400000
    comm_values = [commercial["net"]]
    nc_values = [nonCommercial["net"]]
    for i in range(1, 12):
        comm_values.insert(0, comm_values[0] - int((random.random() - 0.5) * scale * 0.06))
        nc_values.insert(0, nc_values[0] - int((random.random() - 0.48) * scale * 0.08))

    cot = {
        "instrument": ticker.split('/')[0] if '/' in ticker else ticker,
        "reportDate": now - (int(random.random() * 3) * 86400000),
        "openInterest": int(scale * (1.2 + random.random() * 0.5)),
        "commercial": commercial,
        "nonCommercial": nonCommercial,
        "nonReportable": nonReportable,
        "history": [
            {"timestamp": now - (11 - i) * week_ms, "netCommercial": comm_values[i], "netNonCommercial": nc_values[i]}
            for i in range(12)
        ]
    }

    base2Y = 4.0 + random.random() * 1.5
    base5Y = 4.1 + random.random() * 1.2
    base10Y = 4.2 + random.random() * 1.0
    base30Y = 4.3 + random.random() * 0.8

    yields = {
        "country": "US",
        "yields": [
            {"tenor": "2Y", "yield": base2Y, "change": int(random.random() * 20 - 10)},
            {"tenor": "5Y", "yield": base5Y, "change": int(random.random() * 18 - 9)},
            {"tenor": "10Y", "yield": base10Y, "change": int(random.random() * 15 - 8)},
            {"tenor": "30Y", "yield": base30Y, "change": int(random.random() * 12 - 6)}
        ],
        "realYield10Y": round(base10Y - (2.0 + random.random() * 2), 2),
        "spread2s10s": round(base10Y - base2Y, 2),
        "history": [
            {"timestamp": now - (30 - i) * day_ms, "y2": round(base2Y + (random.random() - 0.5) * 0.3, 2), "y10": round(base10Y + (random.random() - 0.5) * 0.25, 2)}
            for i in range(30)
        ]
    }

    return {
        "ticker": ticker,
        "name": ticker,
        "prices": prices,
        "financials": financials,
        "earningsDates": earningsDates,
        "news": news,
        "sentiment": sentiment_data,
        "cot": cot,
        "yields": yields
    }
