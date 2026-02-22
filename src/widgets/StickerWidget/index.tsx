import { useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';

type Props = {
  widgetId: string;
  content?: string;
};

export default function StickerWidget({ widgetId, content = '' }: Props) {
  const updateWidgetData = useCanvasStore((s) => s.updateWidgetData);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateWidgetData(widgetId, {
        settings: { content: e.target.value },
      });
    },
    [widgetId, updateWidgetData]
  );

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [content]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder="Write your note..."
        className="nodrag w-full flex-1 min-h-[120px] p-3 text-sm text-gray-800 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 placeholder:text-amber-900/50 font-medium leading-relaxed"
        style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif" }}
      />
    </div>
  );
}
