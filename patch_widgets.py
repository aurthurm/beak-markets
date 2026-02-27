import os
import re

WIDGETS_DIR = '/home/administrator/Documents/Development/beak-insights/tview/canvas-trader/src/widgets'

error_ui = """      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-400">{error}</span>
          </div>
        </div>
      )}"""

for widget in os.listdir(WIDGETS_DIR):
    idx_path = os.path.join(WIDGETS_DIR, widget, 'index.tsx')
    if not os.path.exists(idx_path):
        continue

    with open(idx_path, 'r') as f:
        content = f.read()

    # Skip PortfolioWidget and WatchlistWidget for manual patch later
    if widget in ['PortfolioWidget', 'WatchlistWidget']:
        continue

    # Add error state
    if 'const [error, setError]' not in content:
        content = re.sub(
            r'(const \[dataset, setDataset\] = useState<MarketDataset \| null>\([^)]+\);)',
            r'\1\n  const [error, setError] = useState<string | null>(null);',
            content
        )

    # Add .catch inside useEffect
    if '.catch(' not in content and 'marketService.getDataset' in content:
        content = re.sub(
            r'(marketService\.getDataset\([^)]+\)\.then\(\([^)]+\) => \{\s+if \(active\) setDataset\([^)]+\);\s+\}\));',
            r"\1.catch((err) => { if (active) setError(err.message || 'Error loading data'); });",
            content
        )

    # Add error UI at the top of the main return wrapper
    # Usually it's `return (\n    <div className="flex flex-col...`
    if '{error && (' not in content:
        content = re.sub(
            r'(return \(\s*<div[^>]*className="[^"]*h-full[^"]*"[^>]*>)',
            f'\\1\n{error_ui}',
            content,
            count=1
        )
        content = re.sub(
            r'(return \(\s*<div[^>]*className="w-full h-full[^"]*"[^>]*>)',
            f'\\1\n{error_ui}',
            content,
            count=1
        )

    with open(idx_path, 'w') as f:
        f.write(content)

print("Widgets patched!")
