import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  checked: boolean;
  setUser: (user: AuthUser | null) => void;
  setChecked: (checked: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  checked: false,
  setUser: (user) => set({ user }),
  setChecked: (checked) => set({ checked }),
}));
