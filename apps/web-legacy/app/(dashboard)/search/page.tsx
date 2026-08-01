'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Calendar, ListTodo, BookOpen, FolderKanban, Hash, ExternalLink, Clock, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SearchResult {
  id: string;
  type: 'task' | 'note' | 'project' | 'habit' | 'domain';
  title: string;
  snippet: string;
  score: number;
  workspaceId: string;
  link: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  task: <ListTodo className="h-4 w-4" />,
  note: <BookOpen className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
  habit: <Hash className="h-4 w-4" />,
  domain: <Calendar className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  task: 'bg-blue-500/10 text-blue-600',
  note: 'bg-green-500/10 text-green-600',
  project: 'bg-purple-500/10 text-purple-600',
  habit: 'bg-orange-500/10 text-orange-600',
  domain: 'bg-gray-500/10 text-gray-600',
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="animate-pulse text-sm text-muted-foreground">Loading search...</div></div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['task', 'note', 'project', 'habit', 'domain']);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('project-e-recent-searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  const saveRecentSearch = useCallback((q: string) => {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10);
    setRecentSearches(updated);
    try {
      localStorage.setItem('project-e-recent-searches', JSON.stringify(updated));
    } catch {}
  }, [recentSearches]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q });
      if (selectedTypes.length < 5) params.set('types', selectedTypes.join(','));
      if (selectedDomain !== 'all') params.set('domain', selectedDomain);

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setResults(data.results || []);
      setTotalCount(data.totalCount || 0);
      saveRecentSearch(q);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTypes, selectedDomain, saveRecentSearch]);

  // Initial search from URL param
  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
    router.replace(`/search?q=${encodeURIComponent(query)}`);
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      task: [], note: [], project: [], habit: [], domain: [],
    };
    for (const r of results) {
      if (groups[r.type]) groups[r.type].push(r);
    }
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [results]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="mt-1 text-muted-foreground">Find anything across your workspace.</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, projects, habits..."
            className="pl-10 pr-20"
            autoFocus
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        {['task', 'note', 'project', 'habit', 'domain'].map(type => (
          <Badge
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            className="cursor-pointer capitalize"
            onClick={() => toggleType(type)}
          >
            {typeIcons[type]}
            <span className="ml-1">{type}s</span>
          </Badge>
        ))}
      </div>

      {/* Results */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && query && results.length === 0 && (
        <div className="py-12 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No results found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try different keywords or adjust your filters.
          </p>
        </div>
      )}

      {!query && !loading && (
        <div className="py-12 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Search your workspace</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Type a query above to search across tasks, notes, projects, habits, and domains.
          </p>
          {recentSearches.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">Recent searches</h4>
              <div className="flex flex-wrap justify-center gap-2">
                {recentSearches.map((s, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => { setQuery(s); doSearch(s); }}
                  >
                    <Clock className="mr-1 h-3 w-3" />
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Found {totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>

          <div className="space-y-6">
            {groupedResults.map(([type, items]) => (
              <div key={type}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize">
                  {typeIcons[type]}
                  {type}s
                  <Badge variant="secondary" className="ml-1 text-xs">{items.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {items.map((result) => (
                    <Card
                      key={`${result.type}-${result.id}`}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => router.push(result.link)}
                    >
                      <CardContent className="flex items-start gap-3 p-3">
                        <div className={`mt-0.5 rounded p-1.5 ${typeColors[result.type] || 'bg-gray-500/10'}`}>
                          {typeIcons[result.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{result.title}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                              {result.type}
                            </Badge>
                          </div>
                          {result.snippet && (
                            <p
                              className="mt-1 text-xs text-muted-foreground line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: result.snippet }}
                            />
                          )}
                        </div>
                        <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
