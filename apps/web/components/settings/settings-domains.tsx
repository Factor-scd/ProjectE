'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Domain {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

export function SettingsDomains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomainName, setNewDomainName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {
    try {
      const response = await fetch('/api/domains?sort=sort_order');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addDomain() {
    if (!newDomainName.trim()) return;

    try {
      await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDomainName,
          color: '#3b82f6',
          icon: '📁',
          sort_order: domains.length,
        }),
      });
      setNewDomainName('');
      fetchDomains();
    } catch (error) {
      console.error('Failed to add domain:', error);
    }
  }

  async function deleteDomain(id: string) {
    if (!confirm('Are you sure? This cannot be undone.')) return;

    try {
      await fetch(`/api/domains/${id}`, { method: 'DELETE' });
      fetchDomains();
    } catch (error) {
      console.error('Failed to delete domain:', error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>Manage your workspace domains (e.g., Personal, Work, OTS).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing domains */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading domains...</p>
          ) : (
            domains.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: domain.color }}
                  />
                  <span className="font-medium">{domain.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteDomain(domain.id)}
                  aria-label={`Delete domain: ${domain.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add new domain */}
        <div className="flex gap-2">
          <label htmlFor="new-domain-name" className="sr-only">
            New domain name
          </label>
          <Input
            id="new-domain-name"
            placeholder="New domain name"
            value={newDomainName}
            onChange={(e) => setNewDomainName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          />
          <Button onClick={addDomain}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
