import { create } from "zustand";

type ItemType = "task" | "project" | "habit" | "note" | "event" | null;

interface CreateDialogState {
  type: ItemType;
  open: boolean;
  openCreate: (type: ItemType) => void;
  closeCreate: () => void;
}

export const useCreateDialogStore = create<CreateDialogState>((set) => ({
  type: null,
  open: false,
  openCreate: (type: ItemType) => set({ type, open: true }),
  closeCreate: () => set({ type: null, open: false }),
}));
