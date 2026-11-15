import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import httpx
from fastapi import HTTPException
from canvas_backend import fundamentals, research, worldbank_provider


class ProviderTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        research._cache.clear()
        research._locks.clear()

    async def test_fred_csv_preserves_zero_skips_missing_and_nonfinite(self):
        def handler(request):
            return httpx.Response(200, text="observation_date,TEST\n2025-01-01,.\n2025-01-02,0\n2025-01-03,NaN\n2025-01-04,2.5\n")
        with patch.dict(os.environ, {'FRED_API_KEY': ''}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                result = await fundamentals.fred_series(client, 'TEST')
        self.assertEqual(result['observations'], [{'date':'2025-01-02','value':0.0},{'date':'2025-01-04','value':2.5}])

    async def test_fred_api_key_uses_official_api(self):
        def handler(request):
            self.assertEqual(request.url.host, 'api.stlouisfed.org')
            self.assertEqual(request.url.params['api_key'], 'test-only-key')
            return httpx.Response(200, json={'observations':[{'date':'2025-01-01','value':'4.25'}]})
        with patch.dict(os.environ, {'FRED_API_KEY':'test-only-key'}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                result = await fundamentals.fred_series(client, 'TEST')
        self.assertEqual(result['observations'][0]['value'],4.25)

    async def test_fred_blocked_or_bad_shape_is_unavailable(self):
        for response in [httpx.Response(429), httpx.Response(200,json=[]),httpx.Response(200,json={'observations':[None]})]:
            research._cache.clear()
            with patch.dict(os.environ, {'FRED_API_KEY':'test-only-key'}):
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response)) as client:
                    self.assertIsNone(await fundamentals.fred_series(client,'TEST'))

    async def test_failed_provider_is_cached_briefly(self):
        fetch = AsyncMock(return_value=None)
        await research.cached('failure',fetch)
        await research.cached('failure',fetch)
        fetch.assert_awaited_once()

    async def test_rate_differential_excludes_stopped_series(self):
        today = datetime.now(timezone.utc).date().isoformat()
        async def series(client, sid):
            return {'observations':[{'date':today if sid=='FEDFUNDS' else '2023-12-01','value':4}]}
        with patch.object(fundamentals,'fred_series',series):
            result=await fundamentals.rates('USD/JPY')
        self.assertEqual(result['rows'][1]['status'],'stale')
        self.assertIsNone(result['differential'])

    async def test_cot_contract_fields_and_inverse_quotation_note(self):
        record={'report_date_as_yyyy_mm_dd':'2026-11-10T00:00:00.000','open_interest_all':'500'}
        for prefix in ['comm','noncomm','nonrept']:
            record[f'{prefix}_positions_long_all']='120';record[f'{prefix}_positions_short_all']='100'
        def handler(request):
            self.assertEqual(request.url.params['cftc_contract_market_code'],'097741')
            return httpx.Response(200,json=[record])
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch.object(fundamentals.httpx,'AsyncClient',return_value=client):
            result=await fundamentals.cot('USD/JPY')
        self.assertEqual(result['reports'][0]['groups'][0]['net'],20)
        self.assertEqual(result['reports'][0]['open_interest'],500)
        self.assertIn('opposite',result['note'])

    async def test_cot_cross_pair_has_no_inferred_contract(self):
        with self.assertRaises(HTTPException) as error:
            await fundamentals.cot('EUR/GBP')
        self.assertEqual(error.exception.status_code,404)

    def test_worldbank_annual_partial_malformed_and_missing(self):
        indicator={'id':'NY.GDP.MKTP.KD.ZG'}
        result=worldbank_provider.parse_macro([{},[
            {'indicator':indicator,'date':'2025','value':None},
            {'indicator':indicator,'date':'2024','value':0},
            {'indicator':indicator,'date':'bad','value':4},
            {'indicator':indicator,'date':'2023','value':'NaN'},None]],'US')
        self.assertEqual(result['gdp_growth'],[{'year':2024,'value':0.0}])
        self.assertEqual(result['frequency'],'annual')
        self.assertEqual(result['cpi'],[])

    async def test_board_malformed_saved_analysis_never_reaches_frontend(self):
        client=httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200,json={'article_count':2,'drivers':[{}],'confidence':'invalid'})))
        with patch.dict(os.environ,{'ANALYSIS_API_URL':'http://saved-analysis.test'}), patch.object(research.httpx,'AsyncClient',return_value=client):
            result=await research.board()
        self.assertTrue(all(row['status']=='unavailable' and row['analysis'] is None for row in result['rows']))
