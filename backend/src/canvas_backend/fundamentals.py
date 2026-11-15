"""Public-data adapters informed by the sibling OpenBB and Fincept providers.

No invented observations: preserve dates, frequencies, missing values and source.
"""
from __future__ import annotations

import asyncio
import csv
import io
import math
import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException

from canvas_backend import worldbank_provider
from canvas_backend.research import SUPPORTED, cached, load_bars, now_iso

router = APIRouter(prefix='/api/research', tags=['fundamentals'])
COUNTRIES = {'USD':'US','EUR':'EMU','GBP':'GB','JPY':'JP','CHF':'CH','AUD':'AU','CAD':'CA','NZD':'NZ'}
POLICY = {'USD':'FEDFUNDS','EUR':'ECBDFR','GBP':'IRSTCB01GBM156N','JPY':'IRSTCB01JPM156N','CHF':'IRSTCB01CHM156N','AUD':'IRSTCB01AUM156N','CAD':'IRSTCB01CAM156N','NZD':'IRSTCB01NZM156N'}
CONTRACTS = {'EUR/USD':('099741','Euro FX'), 'GBP/USD':('096742','British pound'), 'USD/JPY':('097741','Japanese yen'), 'USD/CHF':('092741','Swiss franc'), 'AUD/USD':('232741','Australian dollar'), 'USD/CAD':('090741','Canadian dollar'), 'XAU/USD':('088691','Gold')}


def pair_parts(ticker):
    if ticker not in SUPPORTED:
        raise HTTPException(404,'Unsupported ticker')
    return ticker.split('/') if '/' in ticker else ['USD']


async def fred_series(client, series):
    """FRED public graph CSV, or official API when FRED_API_KEY is configured."""
    async def fetch():
        key = os.getenv('FRED_API_KEY','')
        try:
            if key:
                response=await client.get('https://api.stlouisfed.org/fred/series/observations',params={'series_id':series,'api_key':key,'file_type':'json','sort_order':'desc','limit':400})
                response.raise_for_status()
                payload = response.json()
                raw = payload.get('observations', []) if isinstance(payload, dict) else []
            else:
                start=(datetime.now(timezone.utc)-timedelta(days=1000)).date().isoformat()
                response=await client.get('https://fred.stlouisfed.org/graph/graph.csv',params={'id':series,'cosd':start})
                response.raise_for_status()
                raw=[{'date':r.get('observation_date') or r.get('DATE'),'value':r.get(series)} for r in csv.DictReader(io.StringIO(response.text))]
            values=[]
            for row in raw if isinstance(raw, list) else []:
                try:
                    date=datetime.fromisoformat(row['date']).date().isoformat()
                    value=float(row['value'])
                    if math.isfinite(value):values.append({'date':date,'value':value})
                except (TypeError,ValueError,KeyError):continue
            values.sort(key=lambda r:r['date'])
            return {'series':series,'observations':values,'fetched_at':now_iso()} if values else None
        except (httpx.HTTPError,ValueError):return None
    return await cached('fred:'+series,fetch,ttl=14400)


@router.get('/macro')
async def macro(ticker: str='EUR/USD'):
    currencies=pair_parts(ticker)
    async def one(currency):
        country = COUNTRIES.get(currency)
        if not country:
            return {'currency': currency, 'status': 'unavailable', 'data': None}
        async def fetch():
            result = await worldbank_provider.fetch_macro(country)
            return dict(result, fetched_at=now_iso()) if result else None
        data = await cached('wb:'+country, fetch, ttl=86400)
        return {'currency': currency, 'country': country, 'status': 'available' if data else 'unavailable', 'data': data}
    rows = await asyncio.gather(*(one(currency) for currency in currencies))
    return {'source':'World Bank Open Data','fetched_at':now_iso(),'rows':rows,'note':'Annual observations, with original years. This is structural context, not a live economic-release feed.'}


@router.get('/rates')
async def rates(ticker: str='EUR/USD'):
    currencies=pair_parts(ticker)
    async with httpx.AsyncClient(timeout=12,follow_redirects=True) as client:
        results=await asyncio.gather(*(fred_series(client,POLICY[c]) if c in POLICY else asyncio.sleep(0,result=None) for c in currencies))
    rows=[]
    for currency,data in zip(currencies,results):
        latest=data['observations'][-1] if data else None
        rows.append({'currency':currency,'series':POLICY.get(currency),'latest':latest,'frequency':'daily' if currency == 'EUR' else 'monthly', 'source_url':f'https://fred.stlouisfed.org/series/{POLICY.get(currency)}', 'status':('stale' if latest and (datetime.now(timezone.utc).date()-datetime.fromisoformat(latest['date']).date()).days > 90 else 'available' if latest else 'unavailable')})
    diff=None
    if len(rows)==2 and all(r['latest'] and r['status']=='available' for r in rows):diff=round(rows[0]['latest']['value']-rows[1]['latest']['value'],4)
    return {'source':'FRED rate observations','fetched_at':now_iso(),'rows':rows,'differential':diff,'note':'Observed rate series may be monthly and lagged. FEDFUNDS is the effective monthly rate, not the Fed target range. Some OECD series have stopped updating; stale rows are excluded from the differential. Dates may differ between series. If public CSV access fails, configure FRED_API_KEY. A rate difference is not a broker carry quote or a forecast.'}


@router.get('/yields')
async def yields():
    series={'2Y':'DGS2','5Y':'DGS5','10Y':'DGS10','30Y':'DGS30','10Y real (TIPS)':'DFII10'}
    async with httpx.AsyncClient(timeout=12,follow_redirects=True) as client:
        results=await asyncio.gather(*(fred_series(client,s) for s in series.values()))
    rows=[{'tenor':tenor,'series':sid,'frequency':'daily','source_url':f'https://fred.stlouisfed.org/series/{sid}','latest':data['observations'][-1] if data else None} for (tenor,sid),data in zip(series.items(),results)]
    if not any(r['latest'] for r in rows):raise HTTPException(503,'US yield observations unavailable. Public FRED CSV may be blocked; configure FRED_API_KEY for the official API. No synthetic curve is substituted.')
    return {'source':'FRED / US Treasury reference yields','fetched_at':now_iso(),'rows':rows,'note':'US reference curve for every selected FX pair. Dates are shown per tenor. Real yield uses DFII10, not a fixed inflation subtraction.'}


@router.get('/cot')
async def cot(ticker: str='EUR/USD'):
    pair_parts(ticker)
    contract=CONTRACTS.get(ticker)
    if not contract:raise HTTPException(404,'No single CFTC contract is mapped to this pair. Cross-pair positioning is not inferred.')
    code,name=contract
    async def fetch():
        # Same public Legacy futures-only dataset used by OpenBB's CFTC provider.
        async with httpx.AsyncClient(timeout=15,follow_redirects=True) as client:
            try:
                response=await client.get('https://publicreporting.cftc.gov/resource/6dca-aqww.json',params={'cftc_contract_market_code':code,'$order':'report_date_as_yyyy_mm_dd DESC','$limit':52})
                response.raise_for_status()
                raw=response.json()
                if not isinstance(raw,list) or not raw:return None
                rows=[]
                for record in raw:
                    date=datetime.fromisoformat(record['report_date_as_yyyy_mm_dd'].replace('Z','+00:00')).date().isoformat()
                    groups=[]
                    for label,prefix in [('Commercial','comm'),('Non-commercial','noncomm'),('Non-reportable','nonrept')]:
                        long=int(record[f'{prefix}_positions_long_all'])
                        short=int(record[f'{prefix}_positions_short_all'])
                        groups.append({'label':label,'long':long,'short':short,'net':long-short})
                    rows.append({'date':date,'open_interest':int(record['open_interest_all']),'groups':groups})
                rows.sort(key=lambda r:r['date'],reverse=True)
                return {'reports':rows,'fetched_at':now_iso()}
            except (httpx.HTTPError,KeyError,ValueError,TypeError):return None
    data=await cached('cot:'+code,fetch,ttl=21600)
    if not data:raise HTTPException(503,'CFTC public reporting API unavailable, blocked, or its schema changed. No demo positions are substituted.')
    return dict(data,source='CFTC Legacy futures-only',source_url='https://publicreporting.cftc.gov/resource/6dca-aqww.json',frequency='weekly',contract=name,contract_code=code,note='Weekly futures positions, not the whole spot FX market. JPY/CHF/CAD contracts quote the foreign currency against USD, opposite to USD/JPY, USD/CHF and USD/CAD.')


@router.get('/momentum')
async def momentum(ticker: str='EUR/USD'):
    pair_parts(ticker)
    bars=await asyncio.to_thread(load_bars,ticker)
    cutoff=int(datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()*1000)
    bars=sorted([b for b in bars if b['timestamp']<cutoff and b['close']>0],key=lambda b:b['timestamp'])
    if len(bars)<21:raise HTTPException(503,'Not enough completed daily prices for momentum.')
    last=bars[-1]
    rows=[{'window':n,'change_pct':round((last['close']/bars[-1-n]['close']-1)*100,3)} for n in (5,20)]
    return {'source':'Yahoo gold futures proxy (GC=F)' if ticker == 'XAU/USD' else 'Yahoo daily price momentum','fetched_at':now_iso(),'as_of':last['timestamp'],'rows':rows,'note':'Price returns only. This does not measure news sentiment, retail positioning or executed order flow.'}
