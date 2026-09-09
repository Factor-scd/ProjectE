import { create } from "zustand";

type ItemType = "task" | "project" | "habit" | "note" | "event" | null;

export interface CreatePrefill {
  title?: string;
  dueDate?: string;
  priority?: string;
  tags?: string[];
}

interface CreateDialogState {
  type: ItemType;
  open: boolean;
  prefill: CreatePrefill | null;
  openCreate: (type: ItemType, prefill?: CreatePrefill) => void;
  closeCreate: () => void;
}

export const useCreateDialogStore = create<CreateDialogState>((set) => ({
  type: null,
  open: false,
  prefill: null,
  openCreate: (type: ItemType, prefill?: CreatePrefill) =>
    set({ type, open: true, prefill: prefill || null }),
  closeCreate: () => set({ type: null, open: false, prefill: null }),
}));
