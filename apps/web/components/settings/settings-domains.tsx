'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [newDomainColor, setNewDomainColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/domains?sort=sort_order');
      if (!response.ok) throw new Error('Unable to load domains.');
      const data = await response.json();
      setDomains(data.items || []);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      setError('Unable to load domains. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function addDomain() {
    if (!newDomainName.trim()) return;

    setCreating(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDomainName,
          color: newDomainColor,
          icon: '📁',
          sort_order: domains.length,
        }),
      });
      if (!response.ok) throw new Error('Unable to add domain.');
      setNewDomainName('');
      setStatus('Domain added successfully.');
      await fetchDomains();
    } catch (error) {
      console.error('Failed to add domain:', error);
      setError('Unable to add domain. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function deleteDomain() {
    if (!domainToDelete) return;

    setDeletingId(domainToDelete.id);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/domains/${domainToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete domain.');
      setDomainToDelete(null);
      setStatus('Domain deleted successfully.');
      await fetchDomains();
    } catch (error) {
      console.error('Failed to delete domain:', error);
      setError('Unable to delete domain. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>Manage your workspace domains (e.g., Personal, Work, OTS).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center justify-between gap-3 text-sm text-destructive" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchDomains} disabled={loading}>Retry</Button>
          </div>
        )}
        {status && <p className="text-sm text-muted-foreground" role="status">{status}</p>}
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
                  onClick={() => setDomainToDelete(domain)}
                  aria-label={`Delete domain: ${domain.name}`}
                  disabled={deletingId === domain.id}
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
          <div className="flex gap-2 flex-1">
            <Input
              id="new-domain-name"
              placeholder="New domain name"
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              disabled={creating}
              className="flex-1"
            />
            <input
              type="color"
              value={newDomainColor}
              onChange={(e) => setNewDomainColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border"
              title="Domain color"
              disabled={creating}
            />
          </div>
          <Button onClick={addDomain} disabled={creating || !newDomainName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            {creating ? 'Adding...' : 'Add'}
          </Button>
        </div>
        <AlertDialog open={!!domainToDelete} onOpenChange={(open) => !open && setDomainToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {domainToDelete?.name}?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteDomain} disabled={!!deletingId}>
                {deletingId ? 'Deleting...' : 'Delete domain'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
