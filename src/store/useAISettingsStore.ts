import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mock';

export type NewsSourceMode = 'web_search' | 'specific_sites';

export const AI_PROVIDERS: { id: AIProvider; label: string; models: string[] }[] = [
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
  { id: 'google', label: 'Google', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'] },
  { id: 'mock', label: 'Mock (no API)', models: ['local'] },
];

export const NEWS_SITES: { id: string; label: string; domain: string }[] = [
  { id: 'reuters', label: 'Reuters', domain: 'reuters.com' },
  { id: 'bloomberg', label: 'Bloomberg', domain: 'bloomberg.com' },
  { id: 'fxstreet', label: 'FX Street', domain: 'fxstreet.com' },
  { id: 'forexlive', label: 'ForexLive', domain: 'forexlive.com' },
  { id: 'dailyfx', label: 'DailyFX', domain: 'dailyfx.com' },
  { id: 'investing', label: 'Investing.com', domain: 'investing.com' },
  { id: 'cnbc', label: 'CNBC', domain: 'cnbc.com' },
  { id: 'ft', label: 'Financial Times', domain: 'ft.com' },
  { id: 'marketwatch', label: 'MarketWatch', domain: 'marketwatch.com' },
  { id: 'yahoo', label: 'Yahoo Finance', domain: 'finance.yahoo.com' },
];

type AISettingsState = {
  provider: AIProvider;
  model: string;
  apiKey: string;
  newsSourceMode: NewsSourceMode;
  selectedSiteIds: string[];
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setNewsSourceMode: (mode: NewsSourceMode) => void;
  toggleSite: (siteId: string) => void;
  setSelectedSites: (ids: string[]) => void;
};

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      provider: 'mock',
      model: 'local',
      apiKey: '',
      newsSourceMode: 'specific_sites',
      selectedSiteIds: ['reuters', 'bloomberg', 'fxstreet', 'forexlive', 'dailyfx'],

      setProvider: (provider) =>
        set((s) => {
          const providerConfig = AI_PROVIDERS.find((p) => p.id === provider);
          const model = providerConfig?.models[0] ?? 'local';
          return { provider, model };
        }),

      setModel: (model) => set({ model }),

      setApiKey: (apiKey) => set({ apiKey }),

      setNewsSourceMode: (newsSourceMode) => set({ newsSourceMode }),

      toggleSite: (siteId) =>
        set((s) => ({
          selectedSiteIds: s.selectedSiteIds.includes(siteId)
            ? s.selectedSiteIds.filter((id) => id !== siteId)
            : [...s.selectedSiteIds, siteId],
        })),

      setSelectedSites: (selectedSiteIds) => set({ selectedSiteIds }),
    }),
    {
      name: 'canvas-trader-ai-settings',
      partialize: (s) => ({
        provider: s.provider,
        model: s.model,
        apiKey: s.apiKey,
        newsSourceMode: s.newsSourceMode,
        selectedSiteIds: s.selectedSiteIds,
      }),
    }
  )
);
