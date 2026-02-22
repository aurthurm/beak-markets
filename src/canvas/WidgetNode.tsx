import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { WidgetContainer } from './WidgetContainer';
import { useTickerStore } from '../store/useTickerStore';
import type { WidgetConfig } from '../types';

import ChartWidget from '../widgets/ChartWidget';
import WatchlistWidget from '../widgets/WatchlistWidget';
import FinancialsWidget from '../widgets/FinancialsWidget';
import ValuationWidget from '../widgets/ValuationWidget';
import InterestRatesWidget from '../widgets/InterestRatesWidget';
import AlertsWidget from '../widgets/AlertsWidget';
import PortfolioWidget from '../widgets/PortfolioWidget';
import EarningsWidget from '../widgets/EarningsWidget';
import NewsWidget from '../widgets/NewsWidget';
import SentimentWidget from '../widgets/SentimentWidget';
import YoutubeWidget from '../widgets/YoutubeWidget';
import COTWidget from '../widgets/COTWidget';
import AINewsWidget from '../widgets/AINewsWidget';
import YieldsBondsWidget from '../widgets/YieldsBondsWidget';
import StickerWidget from '../widgets/StickerWidget';
import BeakChartWidget from '../widgets/BeakChartWidget';

function WidgetNodeInner({ data, selected }: NodeProps) {
  const widgetData = data as unknown as WidgetConfig;
  const globalTicker = useTickerStore((s) => s.globalTicker);

  const effectiveTicker = widgetData.syncTicker ? globalTicker : widgetData.ticker;

  const renderWidget = () => {
    switch (widgetData.type) {
      case 'chart':
        return <ChartWidget ticker={effectiveTicker} />;
      case 'beakchart':
        return <BeakChartWidget ticker={effectiveTicker} />;
      case 'watchlist':
        return <WatchlistWidget ticker={effectiveTicker} widgetId={widgetData.id} />;
      case 'financials':
        return <FinancialsWidget ticker={effectiveTicker} />;
      case 'valuation':
        return <ValuationWidget ticker={effectiveTicker} />;
      case 'interestRates':
        return <InterestRatesWidget ticker={effectiveTicker} />;
      case 'alerts':
        return <AlertsWidget ticker={effectiveTicker} />;
      case 'portfolio':
        return <PortfolioWidget />;
      case 'earnings':
        return <EarningsWidget ticker={effectiveTicker} />;
      case 'news':
        return <NewsWidget ticker={effectiveTicker} />;
      case 'sentiment':
        return <SentimentWidget ticker={effectiveTicker} />;
      case 'youtube':
        return <YoutubeWidget data={widgetData} />;
      case 'cot':
        return <COTWidget ticker={effectiveTicker} />;
      case 'ainews':
        return <AINewsWidget ticker={effectiveTicker} />;
      case 'yields':
        return <YieldsBondsWidget ticker={effectiveTicker} />;
      case 'sticker':
        return (
          <StickerWidget
            widgetId={widgetData.id}
            content={(widgetData.settings?.content as string) ?? ''}
          />
        );
      default:
        return <div className="text-gray-500 text-xs">Unknown widget type</div>;
    }
  };

  return (
    <WidgetContainer data={{ ...widgetData, ticker: effectiveTicker }} selected={selected}>
      {renderWidget()}
    </WidgetContainer>
  );
}

export const WidgetNode = memo(WidgetNodeInner);
