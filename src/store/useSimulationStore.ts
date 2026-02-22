import { create } from 'zustand';

type SimulationStore = {
  playing: boolean;
  speed: number;
  currentIndex: number;
  maxIndex: number;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  tick: () => void;
  setCurrentIndex: (index: number) => void;
  setMaxIndex: (max: number) => void;
  reset: () => void;
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  playing: false,
  speed: 1,
  currentIndex: 251,
  maxIndex: 251,
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  setSpeed: (speed) => set({ speed }),
  tick: () => {
    const { currentIndex, maxIndex } = get();
    if (currentIndex < maxIndex) {
      set({ currentIndex: currentIndex + 1 });
    } else {
      set({ playing: false });
    }
  },
  setCurrentIndex: (index) => set({ currentIndex: index }),
  setMaxIndex: (max) => set({ maxIndex: max }),
  reset: () => set({ currentIndex: 0, playing: false }),
}));
