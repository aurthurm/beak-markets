import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { WidgetContainer } from './WidgetContainer';
import { useTickerStore } from '../store/useTickerStore';
import type { WidgetConfig } from '../types';

import COTWidget from '../widgets/COTWidget';
import ChartWidget from '../widgets/ChartWidget';
import WatchlistWidget from '../widgets/WatchlistWidget';
import AlertsWidget from '../widgets/AlertsWidget';
import PortfolioWidget from '../widgets/PortfolioWidget';
import EarningsWidget from '../widgets/EarningsWidget';
import NewsWidget from '../widgets/ResearchWidgets/News';
import YoutubeWidget from '../widgets/YoutubeWidget';
import Fundamentals from '../widgets/ResearchWidgets/Fundamentals';
import Briefing from '../widgets/ResearchWidgets/Briefing';
import MacroBoard from '../widgets/ResearchWidgets/MacroBoard';
import Liquidity from '../widgets/ResearchWidgets/Liquidity';
import Scenario from '../widgets/ResearchWidgets/Scenario';
import StickerWidget from '../widgets/StickerWidget';
import BeakChartWidget from '../widgets/BeakChartWidget';

function WidgetNodeInner({ data, selected }: NodeProps) {
  const widgetData = data as unknown as WidgetConfig;
  const globalTicker = useTickerStore((s) => s.globalTicker);

  const effectiveTicker = widgetData.syncTicker ? globalTicker : widgetData.ticker;

  const renderWidget = () => {
    switch (widgetData.type) {
      case 'chart':
        return <ChartWidget key={effectiveTicker} ticker={effectiveTicker} data={widgetData} />;
      case 'beakchart':
        return <BeakChartWidget key={effectiveTicker} ticker={effectiveTicker} />;
      case 'watchlist':
        return <WatchlistWidget ticker={effectiveTicker} widgetId={widgetData.id} />;
      case 'financials':
        return <Fundamentals key={`financials-${effectiveTicker}`} kind="financials" ticker={effectiveTicker} />;
      case 'valuation':
        return <Fundamentals key={`valuation-${effectiveTicker}`} kind="valuation" ticker={effectiveTicker} />;
      case 'interestRates':
        return <Fundamentals key={`interestRates-${effectiveTicker}`} kind="interestRates" ticker={effectiveTicker} />;
      case 'alerts':
        return <AlertsWidget ticker={effectiveTicker} />;
      case 'portfolio':
        return <PortfolioWidget />;
      case 'earnings':
        return <EarningsWidget ticker={effectiveTicker} />;
      case 'news':
        return <NewsWidget ticker={effectiveTicker} />;
      case 'sentiment':
        return <Fundamentals key={`sentiment-${effectiveTicker}`} kind="sentiment" ticker={effectiveTicker} />;
      case 'youtube':
        return <YoutubeWidget data={widgetData} />;
      case 'cot':
        return <COTWidget key={effectiveTicker} ticker={effectiveTicker} />;
      case 'ainews':
        return <MacroBoard />;
      case 'yields':
        return <Fundamentals key={`yields-${effectiveTicker}`} kind="yields" ticker={effectiveTicker} />;
      case 'briefing': return <Briefing data={widgetData} ticker={effectiveTicker} />;
      case 'macroboard': return <MacroBoard />;
      case 'liquidity': return <Liquidity ticker={effectiveTicker} />;
      case 'scenario': return <Scenario data={widgetData} ticker={effectiveTicker} />;
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
