'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface Tag {
  id: string;
  name: string;
  color?: string | null;
  scope?: string | null;
}

const SCOPE_OPTIONS = ['global', 'tasks', 'habits', 'projects', 'notes'] as const;

export function SettingsTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newScope, setNewScope] = useState('global');
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editing, setEditing] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editScope, setEditScope] = useState('global');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditColor(editing.color || '#3b82f6');
      setEditScope(editing.scope || 'global');
    }
  }, [editing]);

  async function fetchTags() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tags?sort=name');
      if (!response.ok) throw new Error('Unable to load tags.');
      const data = await response.json();
      setTags(data.items || []);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError('Unable to load tags. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          scope: newScope,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to create tag.');
      }
      toast.success('Tag created');
      setNewName('');
      setNewColor('#3b82f6');
      setNewScope('global');
      await fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create tag.');
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSave() {
    if (!editing || !editName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/tags/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
          scope: editScope,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to update tag.');
      }
      toast.success('Tag updated');
      setEditing(null);
      await fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update tag.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingId(deleting.id);
    try {
      const response = await fetch(`/api/tags/${deleting.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete tag.');
      toast.success('Tag deleted');
      setDeleting(null);
      await fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete tag.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>Manage tags for organizing tasks, habits, projects, and notes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center justify-between gap-3 text-sm text-destructive" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchTags} disabled={loading}>
              Retry
            </Button>
          </div>
        )}

        {/* Tag list */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading tags...</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet. Create one below.</p>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: tag.color || '#6b7280' }}
                  />
                  <span className="font-medium">{tag.name}</span>
                  {tag.scope && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {tag.scope}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(tag)}
                    aria-label={`Edit tag: ${tag.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(tag)}
                    aria-label={`Delete tag: ${tag.name}`}
                    disabled={deletingId === tag.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create form */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-tag-name" className="text-xs">Name</Label>
            <Input
              id="new-tag-name"
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              disabled={creating}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-tag-color" className="text-xs">Color</Label>
            <input
              id="new-tag-color"
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border"
              disabled={creating}
            />
          </div>
          <div className="w-32 space-y-1">
            <Label htmlFor="new-tag-scope" className="text-xs">Scope</Label>
            <Select value={newScope} onValueChange={setNewScope} disabled={creating}>
              <SelectTrigger id="new-tag-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            {creating ? 'Adding...' : 'Add'}
          </Button>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit tag</DialogTitle>
              <DialogDescription>Update the tag name, color, and scope.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tag-name">Name</Label>
                <Input
                  id="edit-tag-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tag-color">Color</Label>
                <input
                  id="edit-tag-color"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tag-scope">Scope</Label>
                <Select value={editScope} onValueChange={setEditScope}>
                  <SelectTrigger id="edit-tag-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={saving || !editName.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this tag. It will be removed from all associated items.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={!!deletingId}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingId ? 'Deleting...' : 'Delete tag'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
