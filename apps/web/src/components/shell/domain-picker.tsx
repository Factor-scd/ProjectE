import { useEffect } from "react";
import { useApiQuery } from "@/lib/api";
import { useActiveDomainStore } from "@/lib/stores/use-active-domain-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Domain, PaginatedResponse } from "@/lib/types";

export function DomainPicker() {
  const activeDomainId = useActiveDomainStore((s) => s.activeDomainId);
  const setActiveDomain = useActiveDomainStore((s) => s.setActiveDomain);

  const { data, isLoading } = useApiQuery<PaginatedResponse<Domain>>(["domains"], "/domains");
  const domains = data?.items || [];

  // The persisted selection may reference a deleted domain — validate against
  // the fetched list and fall back to the first domain while unset or stale.
  useEffect(() => {
    if (domains.length === 0) return;
    if (!activeDomainId || !domains.some((d) => d.id === activeDomainId)) {
      setActiveDomain(domains[0].id);
    }
  }, [domains, activeDomainId, setActiveDomain]);

  const empty = isLoading || domains.length === 0;

  return (
    <div className="hidden md:block">
      <Select
        value={activeDomainId ?? undefined}
        onValueChange={setActiveDomain}
        disabled={empty}
      >
        <SelectTrigger className="h-8 w-40 text-xs" aria-label="Switch domain">
          <SelectValue placeholder="Domain" />
        </SelectTrigger>
        <SelectContent>
          {domains.map((domain) => (
            <SelectItem key={domain.id} value={domain.id}>
              <span className="flex items-center gap-2">
                {domain.color && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: domain.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{domain.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
