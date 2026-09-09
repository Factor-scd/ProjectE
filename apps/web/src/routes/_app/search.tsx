import { useState, useEffect, useMemo, useRef } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useApiQuery } from "@/lib/api";
import { Search as SearchIcon, X, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import type { SearchResult } from "@/lib/types";
import Fuse from "fuse.js";

const SEARCH_TYPES = [
  { id: "task", label: "Tasks", color: "bg-blue-500" },
  { id: "habit", label: "Habits", color: "bg-green-500" },
  { id: "project", label: "Projects", color: "bg-purple-500" },
  { id: "note", label: "Notes", color: "bg-amber-500" },
  { id: "domain", label: "Domains", color: "bg-indigo-500" },
];

// Sanitize snippet HTML before it hits dangerouslySetInnerHTML. The API's
// ts_headline output is safe text with matches wrapped in <mark>...</mark>.
// Allow ONLY <mark> open/close tags (and only without event handler / href /
// src attributes) so no other element, script, or attribute can be injected.
const sanitizeSnippet = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*)?>/g, (full, tag) => {
      if (tag.toLowerCase() === "mark" && !/<[^>]*(?:on\w+=|href=|src=)/i.test(full)) return full;
      return "";
    });

function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(SEARCH_TYPES.map((t) => t.id)));
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recentSearches") || "[]");
    } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const activeDomainId = useApiDomain();

  const { data: searchData, isLoading } = useApiQuery<{ results: SearchResult[]; totalCount: number }>(
    ["search", activeDomainId, debouncedQuery, ...Array.from(selectedTypes)],
    "/search?q=" + encodeURIComponent(debouncedQuery) + "&types=" + Array.from(selectedTypes).join(",") + "&limit=50" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  const serverResults = searchData?.results || [];

  const results = useMemo(() => {
    const rawQuery = debouncedQuery.trim();
    const operatorMatch = rawQuery.match(/\b(in|status|tag):(\S+)/g);
    let filtered = serverResults;
    if (operatorMatch) {
      for (const op of operatorMatch) {
        const [key, val] = op.split(":");
        if (key === "in") filtered = filtered.filter(r => r.type === val.toLowerCase());
        if (key === "status") filtered = filtered.filter(r => r.snippet.toLowerCase().includes(val.toLowerCase()) || r.title.toLowerCase().includes(val.toLowerCase()));
      }
    }
    const cleanQuery = rawQuery.replace(/\b(in|status|tag):\S+\s*/g, "").trim();
    if (!cleanQuery) return filtered;
    const fuse = new Fuse(filtered, { keys: ["title", "snippet"], threshold: 0.4, includeScore: true });
    const fused = fuse.search(cleanQuery);
    return fused.length > 0 ? fused.map(f => f.item) : filtered;
  }, [serverResults, debouncedQuery]);

  const toggleType = (typeId: string) => {
    const next = new Set(selectedTypes);
    if (next.has(typeId)) next.delete(typeId);
    else next.add(typeId);
    setSelectedTypes(next);
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim() && q.trim().length > 2) {
      setRecentSearches((prev) => {
        const next = [q.trim(), ...prev.filter((s) => s !== q.trim())].slice(0, 10);
        localStorage.setItem("recentSearches", JSON.stringify(next));
        return next;
      });
    }
  };

  const groupedResults = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search tasks, notes, projects, habits..."
          className="pl-10 pr-10 h-12 text-lg"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={() => { setQuery(""); setDebouncedQuery(""); }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {SEARCH_TYPES.map((type) => (
          <Button
            key={type.id}
            variant={selectedTypes.has(type.id) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleType(type.id)}
            className="gap-1.5"
          >
            <div className={cn("w-2 h-2 rounded-full", type.color)} />
            {type.label}
          </Button>
        ))}
      </div>

      {/* Recent searches */}
      {!debouncedQuery && recentSearches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <Clock className="h-3 w-3" /> Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s, i) => (
              <Button key={i} variant="ghost" size="sm" onClick={() => handleSearch(s)} className="text-sm font-mono">
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {debouncedQuery && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No results found for "<span className="font-mono">{debouncedQuery}</span>"
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-mono">
                <span className="font-semibold">{results.length}</span> result{results.length === 1 ? "" : "s"} · <span className="font-semibold">{Object.keys(groupedResults).length}</span> type{Object.keys(groupedResults).length === 1 ? "" : "s"}
              </p>
              {Object.entries(groupedResults).map(([type, typeResults]) => {
                const typeDef = SEARCH_TYPES.find((t) => t.id === type);
                return (
                  <div key={type}>
                    <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", typeDef?.color)} />
                      {typeDef?.label || type}
                      <Badge variant="secondary" className="text-[10px] font-mono">{typeResults.length}</Badge>
                    </h3>
                    <div className="space-y-0.5">
                      {typeResults.map((result) => (
                        <div
                          key={result.id + result.type}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20 border border-transparent hover:border-border cursor-pointer transition-colors"
                          onClick={() => navigate({ to: result.type === "domain" ? "/settings" : (result.link as any) })}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{result.title}</p>
                            {result.snippet && (
                              <p
                                className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
                              />
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/search",
  component: SearchPage,
});
