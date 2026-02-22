import { useState, useEffect } from 'react';
import { useAISettingsStore, AI_PROVIDERS, NEWS_SITES } from '../../store/useAISettingsStore';

type Props = { isOpen: boolean; onClose: () => void };

export default function AISettingsModal({ isOpen, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<'provider' | 'news_source'>('provider');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasEditedKey, setHasEditedKey] = useState(false);

  const {
    provider,
    model,
    apiKey,
    newsSourceMode,
    selectedSiteIds,
    setProvider,
    setModel,
    setApiKey,
    setNewsSourceMode,
    toggleSite,
  } = useAISettingsStore();

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput('');
      setHasEditedKey(false);
    }
  }, [isOpen]);

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    setHasEditedKey(true);
  };

  const handleApiKeyBlur = () => {
    if (hasEditedKey && apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
    }
  };

  const currentProvider = AI_PROVIDERS.find((p) => p.id === provider);
  const models = currentProvider?.models ?? ['local'];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border border-gray-700 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-violet-400"
            >
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z" />
            </svg>
            <span className="text-sm font-semibold text-white">AI News & Research Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveSection('provider')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSection === 'provider'
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Provider & API
          </button>
          <button
            onClick={() => setActiveSection('news_source')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeSection === 'news_source'
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            News Source
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSection === 'provider' && (
            <>
              {/* Provider */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                  AI Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`px-3 py-2 rounded-lg border text-left text-xs font-medium transition-colors ${
                        provider === p.id
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model */}
              {provider !== 'mock' && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* API Key */}
              {provider !== 'mock' && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    API Key
                    <span className="text-[9px] text-amber-500/80 ml-1">(stored locally)</span>
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    onBlur={handleApiKeyBlur}
                    placeholder={apiKey && !hasEditedKey ? '••••••••••••••••' : provider === 'openai' ? 'sk-...' : 'Enter your API key'}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    Get keys from: OpenAI platform.openai.com, Anthropic console.anthropic.com
                  </p>
                </div>
              )}

              {provider === 'mock' && (
                <div className="rounded-lg p-3 bg-gray-800/50 border border-gray-700/50 text-[11px] text-gray-400">
                  No API key needed. Using mock summaries based on news feed data.
                </div>
              )}
            </>
          )}

          {activeSection === 'news_source' && (
            <>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                  News Source Mode
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      newsSourceMode === 'web_search'
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newsSource"
                      checked={newsSourceMode === 'web_search'}
                      onChange={() => setNewsSourceMode('web_search')}
                      className="mt-1 accent-cyan-500"
                    />
                    <div>
                      <div className="text-xs font-medium text-white">AI Web Search</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        AI performs its own web search to find and summarize relevant news. Requires
                        API key.
                      </div>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      newsSourceMode === 'specific_sites'
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newsSource"
                      checked={newsSourceMode === 'specific_sites'}
                      onChange={() => setNewsSourceMode('specific_sites')}
                      className="mt-1 accent-cyan-500"
                    />
                    <div>
                      <div className="text-xs font-medium text-white">Specific Sites</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Use news from selected financial sites only. Works with mock or API.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {newsSourceMode === 'specific_sites' && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    Select News Sites
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {NEWS_SITES.map((site) => (
                      <label
                        key={site.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSiteIds.includes(site.id)}
                          onChange={() => toggleSite(site.id)}
                          className="accent-cyan-500 rounded"
                        />
                        <span className="text-xs text-gray-300">{site.label}</span>
                        <span className="text-[10px] text-gray-600">{site.domain}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
