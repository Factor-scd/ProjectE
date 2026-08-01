import { create } from 'zustand';

type TimerMode = 'focus' | 'break' | 'idle';

interface TimerState {
  mode: TimerMode;
  isRunning: boolean;
  secondsRemaining: number;
  focusMinutes: number;
  breakMinutes: number;
  currentTaskId: string | null;

  // Actions
  startFocus: (taskId?: string) => void;
  startBreak: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
  setFocusMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  mode: 'idle',
  isRunning: false,
  secondsRemaining: 0,
  focusMinutes: 25,
  breakMinutes: 5,
  currentTaskId: null,

  startFocus: (taskId) =>
    set({
      mode: 'focus',
      isRunning: true,
      secondsRemaining: get().focusMinutes * 60,
      currentTaskId: taskId ?? null,
    }),

  startBreak: () =>
    set({
      mode: 'break',
      isRunning: true,
      secondsRemaining: get().breakMinutes * 60,
    }),

  pause: () => set({ isRunning: false }),
  resume: () => set({ isRunning: true }),

  reset: () =>
    set({
      mode: 'idle',
      isRunning: false,
      secondsRemaining: 0,
      currentTaskId: null,
    }),

  tick: () => {
    const state = get();
    if (!state.isRunning || state.secondsRemaining <= 0) {
      if (state.secondsRemaining <= 0) {
        set({ isRunning: false, mode: 'idle' });
      }
      return;
    }
    set({ secondsRemaining: state.secondsRemaining - 1 });
  },

  setFocusMinutes: (focusMinutes) => set({ focusMinutes }),
  setBreakMinutes: (breakMinutes) => set({ breakMinutes }),
}));
