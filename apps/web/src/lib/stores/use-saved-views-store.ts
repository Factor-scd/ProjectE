import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedView {
  id: string;
  name: string;
  filters: {
    search: string;
    projectId: string;
    stateId: string;
    priority: string;
  };
  createdAt: string;
}

interface SavedViewsState {
  views: SavedView[];
  addView: (name: string, filters: SavedView["filters"]) => void;
  removeView: (id: string) => void;
  updateView: (id: string, updates: Partial<SavedView>) => void;
}

export const useSavedViewsStore = create<SavedViewsState>()(
  persist(
    (set) => ({
      views: [],
      addView: (name, filters) =>
        set((state) => ({
          views: [
            ...state.views,
            { id: crypto.randomUUID(), name, filters, createdAt: new Date().toISOString() },
          ],
        })),
      removeView: (id) =>
        set((state) => ({ views: state.views.filter((v) => v.id !== id) })),
      updateView: (id, updates) =>
        set((state) => ({
          views: state.views.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),
    }),
    { name: "project-e-saved-views" }
  )
);
