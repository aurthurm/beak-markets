import { useCallback, useEffect } from 'react';
import CanvasEngine from './canvas/CanvasEngine';
import Toolbar from './components/Toolbar';
import WidgetSidebar from './components/WidgetSidebar';
import SelectionOverlay from './components/SelectionOverlay';
import { useCanvasStore } from './store/useCanvasStore';
import { captureArea, downloadImage } from './utils/capture';

export default function App() {
  const loadLayout = useCanvasStore((s) => s.loadLayout);
  const nodes = useCanvasStore((s) => s.nodes);
  const addWidget = useCanvasStore((s) => s.addWidget);
  const captureMode = useCanvasStore((s) => s.captureMode);
  const setCaptureMode = useCanvasStore((s) => s.setCaptureMode);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // If no saved layout, create a default workspace
  useEffect(() => {
    if (nodes.length === 0) {
      addWidget('chart', { x: 50, y: 50 });
      addWidget('watchlist', { x: 700, y: 50 });
      addWidget('news', { x: 1040, y: 50 });
      addWidget('sentiment', { x: 50, y: 520 });
      addWidget('financials', { x: 500, y: 520 });
      addWidget('valuation', { x: 940, y: 520 });
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAreaCaptureComplete = useCallback(
    async (rect: { left: number; top: number; width: number; height: number }) => {
      const dataUrl = await captureArea(rect);
      setCaptureMode('none');
      if (dataUrl) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        downloadImage(dataUrl, `canvas-capture-${ts}.png`);
      }
    },
    [setCaptureMode]
  );

  const handleAreaCaptureCancel = useCallback(() => {
    setCaptureMode('none');
  }, [setCaptureMode]);

  return (
    <div className="w-screen h-screen bg-gray-950 overflow-hidden flex flex-col">
      <Toolbar />
      <WidgetSidebar />
      <div className="flex-1 relative">
        <CanvasEngine />
        {captureMode === 'area' && (
          <SelectionOverlay
            onComplete={handleAreaCaptureComplete}
            onCancel={handleAreaCaptureCancel}
          />
        )}
      </div>
    </div>
  );
}
