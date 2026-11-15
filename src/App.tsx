import { useCallback, useEffect } from 'react';
import AlertEvaluator from './components/AlertEvaluator';
import CanvasEngine from './canvas/CanvasEngine';
import Toolbar from './components/Toolbar';
import WidgetSidebar from './components/WidgetSidebar';
import SelectionOverlay from './components/SelectionOverlay';
import { useCanvasStore } from './store/useCanvasStore';
import { captureArea, downloadImage } from './utils/capture';

export default function App() {
  const loadLayout = useCanvasStore((s) => s.loadLayout);
  const captureMode = useCanvasStore((s) => s.captureMode);
  const setCaptureMode = useCanvasStore((s) => s.setCaptureMode);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

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
      <AlertEvaluator />
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
