import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CommandHistoryState {
  history: string[]; // command IDs, most recent first
  record: (commandId: string) => void;
  getRecent: (count?: number) => string[];
}

export const useCommandHistoryStore = create<CommandHistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      record: (commandId) =>
        set((state) => ({
          history: [
            commandId,
            ...state.history.filter((id) => id !== commandId),
          ].slice(0, 20),
        })),
      getRecent: (count = 5) => get().history.slice(0, count),
    }),
    {
      name: "project-e-command-history",
    }
  )
);
