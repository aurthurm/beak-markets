"""Read-only live HTTP smoke test. Unavailable providers are reported, never counted as real data."""
import argparse
import concurrent.futures
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

PATHS = [
    'market/dataset?ticker=EUR/USD', 'market/dataset?ticker=USD/JPY', 'market/dataset?ticker=XAU/USD',
    'research/macro?ticker=EUR/USD', 'research/rates?ticker=USD/JPY', 'research/yields',
    'research/cot?ticker=USD/JPY', 'research/news?ticker=EUR/USD', 'research/calendar',
    'research/liquidity?ticker=EUR/USD', 'research/momentum?ticker=USD/JPY', 'research/board',
]


def check(base, path):
    result = {'path': path}
    try:
        with urlopen(base.rstrip('/') + '/api/' + path, timeout=40) as response:
            data = json.load(response)
            result.update(status=response.status, source=data.get('source'), fetched_at=data.get('fetched_at'))
            for key in ('prices', 'articles', 'events', 'reports'):
                if key in data:
                    result[key + '_count'] = len(data[key])
                    result[key + '_first'] = data[key][:1]
                    if key == 'prices': result['latest_price'] = data[key][-1:]
            for key in ('rows','as_of','bars_used','note'):
                if key in data: result[key] = data[key]
    except HTTPError as error:
        result.update(status=error.code, error=error.read().decode()[:800])
    except Exception as error:
        result.update(status='connection_error', error=str(error))
    return result


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',default='http://127.0.0.1:8001')
    parser.add_argument('--output',default='live-provider-check.json')
    args=parser.parse_args()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda path:check(args.base,path),PATHS))
    Path(args.output).write_text(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),'results':results},indent=2))
    for row in results:print(row['status'],row['path'])
    raise SystemExit(1 if any(row['status']=='connection_error' or isinstance(row['status'],int) and row['status']>=500 and row['status']!=503 for row in results) else 0)
