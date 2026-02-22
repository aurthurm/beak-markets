import { useSimulationStore } from '../store/useSimulationStore';

let intervalId: ReturnType<typeof setInterval> | null = null;

export const simulationService = {
  start() {
    this.stop();
    const tick = () => {
      const { playing, speed, tick } = useSimulationStore.getState();
      if (playing) tick();
    };
    intervalId = setInterval(() => {
      const { speed } = useSimulationStore.getState();
      tick();
      if (speed >= 5) tick();
      if (speed >= 10) {
        tick();
        tick();
      }
    }, 500);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },
};
