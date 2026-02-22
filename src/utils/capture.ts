import { toPng, toCanvas } from 'html-to-image';

const REACT_FLOW_SELECTOR = '.react-flow';
const NODE_SELECTOR = (id: string) => `.react-flow__node[data-id="${id}"]`;
const VIEWPORT_SELECTOR = '.react-flow__viewport';

/** Screen-space rect: coordinates from getBoundingClientRect */
export type ScreenRect = { left: number; top: number; width: number; height: number };

/**
 * Capture a single widget by its node ID.
 * Returns a PNG data URL or null if the node wasn't found.
 */
export async function captureWidget(nodeId: string): Promise<string | null> {
  const flowRoot = document.querySelector(REACT_FLOW_SELECTOR);
  if (!flowRoot) return null;

  const nodeEl = flowRoot.querySelector(NODE_SELECTOR(nodeId)) as HTMLElement | null;
  if (!nodeEl) return null;

  try {
    const dataUrl = await toPng(nodeEl, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#111827',
    });
    return dataUrl;
  } catch (err) {
    console.error('Widget capture failed:', err);
    return null;
  }
}

/**
 * Capture a rectangular region of the canvas.
 * The rect should be in screen coordinates (from getBoundingClientRect).
 */
export async function captureArea(screenRect: ScreenRect): Promise<string | null> {
  const flowRoot = document.querySelector(REACT_FLOW_SELECTOR);
  if (!flowRoot) return null;

  const viewport = flowRoot.querySelector(VIEWPORT_SELECTOR) as HTMLElement | null;
  if (!viewport) return null;

  const vpRect = viewport.getBoundingClientRect();
  const x = screenRect.left - vpRect.left;
  const y = screenRect.top - vpRect.top;
  const width = screenRect.width;
  const height = screenRect.height;

  try {
    const fullCanvas = await toCanvas(viewport, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#111827',
    });
    if (width <= 0 || height <= 0 || x < 0 || y < 0) return null;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.floor(width * 2);
    cropCanvas.height = Math.floor(height * 2);
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(
      fullCanvas,
      Math.floor(x * 2),
      Math.floor(y * 2),
      Math.floor(width * 2),
      Math.floor(height * 2),
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    return cropCanvas.toDataURL('image/png');
  } catch (err) {
    console.error('Area capture failed:', err);
    return null;
  }
}

/**
 * Download a data URL as a file.
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
