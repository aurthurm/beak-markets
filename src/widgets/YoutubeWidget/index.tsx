import { useState, useCallback } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import type { WidgetConfig } from '../../types';

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

type Props = { data: WidgetConfig };

export default function YoutubeWidget({ data }: Props) {
  const updateWidgetData = useCanvasStore((s) => s.updateWidgetData);
  const videoUrl = (data.settings?.videoUrl as string) ?? '';
  const [inputValue, setInputValue] = useState(videoUrl);
  const [committedId, setCommittedId] = useState<string | null>(() => extractVideoId(videoUrl));

  const handleSubmit = useCallback(() => {
    const id = extractVideoId(inputValue);
    if (id) {
      setCommittedId(id);
      updateWidgetData(data.id, {
        settings: { ...data.settings, videoUrl: inputValue.trim() },
      });
    } else {
      setCommittedId(null);
    }
  }, [inputValue, data.id, data.settings, updateWidgetData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit]
  );

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2 nodrag">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          placeholder="YouTube URL or video ID"
          className="flex-1 px-2.5 py-1.5 text-xs bg-gray-800/80 border border-gray-600/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
        />
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors"
        >
          Play
        </button>
      </div>

      <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-black/40 border border-gray-700/40 aspect-video">
        {committedId ? (
          <iframe
            src={`https://www.youtube.com/embed/${committedId}?autoplay=0`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
            Enter a YouTube URL or video ID
          </div>
        )}
      </div>
    </div>
  );
}
