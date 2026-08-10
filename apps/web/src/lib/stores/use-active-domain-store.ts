import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useApiQuery } from "@/lib/api";

interface ActiveDomainState {
  activeDomainId: string | null;
  setActiveDomain: (id: string | null) => void;
}

export const useActiveDomainStore = create<ActiveDomainState>()(
  persist(
    (set) => ({
      activeDomainId: null,
      setActiveDomain: (id) => set({ activeDomainId: id }),
    }),
    {
      name: "project-e-active-domain",
    }
  )
);

// Raw selector: reads the persisted value (may reference a deleted domain).
export function useActiveDomainId(): string | null {
  return useActiveDomainStore((s) => s.activeDomainId);
}

// Resolved active domain id for API calls. Validates the persisted value
// against the user's domains (falling back to the first domain) so consumers
// never query a domain that no longer exists. Returns "" until domains load.
// Shares the ["domains"] query cache, so it adds no extra network requests.
export function useApiDomain(): string {
  const activeDomainId = useActiveDomainId();
  const { data } = useApiQuery<{ items: { id: string }[] }>(["domains"], "/domains");
  const items = data?.items || [];
  if (items.length === 0) return "";
  if (activeDomainId && items.some((d) => d.id === activeDomainId)) return activeDomainId;
  return items[0].id;
}
