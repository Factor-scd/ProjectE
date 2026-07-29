'use client';

import { useEffect, useState } from 'react';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface Agent {
  id: string;
  name: string;
  api_key: string;
  permission_tier: string;
  status: 'active' | 'disabled';
}

export function SettingsAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentTier, setNewAgentTier] = useState('read_only');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) throw new Error('Unable to load agents.');
      const data = await response.json();
      setAgents(data.items || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setError('Unable to load agents. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function createAgent() {
    if (!newAgentName.trim()) return;

    setCreating(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName,
          permission_tier: newAgentTier,
          status: 'active',
        }),
      });
      if (!response.ok) throw new Error('Unable to create agent.');
      setNewAgentName('');
      setCreateDialogOpen(false);
      setStatus('Agent created successfully.');
      await fetchAgents();
    } catch (error) {
      console.error('Failed to create agent:', error);
      setError('Unable to create agent. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function deleteAgent() {
    if (!agentToDelete) return;

    setDeletingId(agentToDelete.id);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/agents/${agentToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete agent.');
      setAgentToDelete(null);
      setStatus('Agent deleted successfully.');
      await fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
      setError('Unable to delete agent. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  function copyApiKey(apiKey: string) {
    navigator.clipboard.writeText(apiKey);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agents & Permissions</CardTitle>
            <CardDescription>Manage AI agents and their access levels.</CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                New agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Agent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input
                    id="agent-name"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g., Hermes, Claude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-tier">Permission tier</Label>
                  <Select value={newAgentTier} onValueChange={setNewAgentTier}>
                    <SelectTrigger id="agent-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_access">Full Access</SelectItem>
                      <SelectItem value="read_only">Read Only</SelectItem>
                      <SelectItem value="content_creator">Content Creator</SelectItem>
                      <SelectItem value="task_manager">Task Manager</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createAgent} className="w-full">
                  Create agent
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm text-destructive" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading}>Retry</Button>
          </div>
        )}
        {status && <p className="mb-4 text-sm text-muted-foreground" role="status">{status}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading agents...
          </p>
        ) : agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No agents configured
          </p>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{agent.name}</h3>
                      <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {agent.permission_tier.replace('_', ' ')}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {agent.api_key.slice(0, 8)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyApiKey(agent.api_key)}
                        aria-label={`Copy API key for ${agent.name}`}
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAgentToDelete(agent)}
                    aria-label={`Delete agent: ${agent.name}`}
                    disabled={deletingId === agent.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <AlertDialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {agentToDelete?.name}?</AlertDialogTitle>
              <AlertDialogDescription>This will revoke the agent&apos;s access.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAgent} disabled={!!deletingId}>
                {deletingId ? 'Deleting...' : 'Delete agent'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
