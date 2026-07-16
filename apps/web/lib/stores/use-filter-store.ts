import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  domain: string | null;
  project: string | null;
  tags: string[];
  status: string | null;
  priority: string | null;

  // Actions
  setDomain: (domain: string | null) => void;
  setProject: (project: string | null) => void;
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setStatus: (status: string | null) => void;
  setPriority: (priority: string | null) => void;
  clearAll: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      domain: null,
      project: null,
      tags: [],
      status: null,
      priority: null,

      setDomain: (domain) => set({ domain }),
      setProject: (project) => set({ project }),
      setTags: (tags) => set({ tags }),
      addTag: (tag) =>
        set((state) => ({
          tags: state.tags.includes(tag) ? state.tags : [...state.tags, tag],
        })),
      removeTag: (tag) =>
        set((state) => ({
          tags: state.tags.filter((t) => t !== tag),
        })),
      setStatus: (status) => set({ status }),
      setPriority: (priority) => set({ priority }),
      clearAll: () =>
        set({
          domain: null,
          project: null,
          tags: [],
          status: null,
          priority: null,
        }),
    }),
    {
      name: 'project-e-filters',
    }
  )
);
