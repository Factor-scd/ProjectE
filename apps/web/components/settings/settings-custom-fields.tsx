'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STORAGE_KEY = 'pe_custom_field_schemas';

type FieldType = 'text' | 'number' | 'select' | 'checkbox';
type FieldScope = 'task' | 'habit' | 'project' | 'note';

interface FieldSchema {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
  scope: FieldScope;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
];

const SCOPE_OPTIONS: { value: FieldScope; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'habit', label: 'Habit' },
  { value: 'project', label: 'Project' },
  { value: 'note', label: 'Note' },
];

function loadSchemas(): FieldSchema[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchemas(schemas: FieldSchema[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
}

export function SettingsCustomFields() {
  const [schemas, setSchemas] = useState<FieldSchema[]>([]);
  const [filterScope, setFilterScope] = useState<FieldScope | 'all'>('all');

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newScope, setNewScope] = useState<FieldScope>('task');
  const [newOptions, setNewOptions] = useState('');

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSchemas(loadSchemas());
  }, []);

  const filteredSchemas = filterScope === 'all'
    ? schemas
    : schemas.filter((s) => s.scope === filterScope);

  function handleAdd() {
    if (!newName.trim()) return;
    const newSchema: FieldSchema = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: newName.trim(),
      type: newType,
      scope: newScope,
      options: newType === 'select' ? newOptions.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
    };
    const updated = [...schemas, newSchema];
    saveSchemas(updated);
    setSchemas(updated);
    toast.success('Custom field added');
    setNewName('');
    setNewType('text');
    setNewOptions('');
  }

  function handleDelete(id: string) {
    const updated = schemas.filter((s) => s.id !== id);
    saveSchemas(updated);
    setSchemas(updated);
    setDeletingId(null);
    toast.success('Custom field removed');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Fields</CardTitle>
        <CardDescription>
          Define custom field schemas for tasks, habits, projects, and notes. Stored locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope filter */}
        <div className="flex items-center gap-2">
          <Label htmlFor="cf-filter-scope" className="text-xs">Filter by scope:</Label>
          <Select value={filterScope} onValueChange={(v) => setFilterScope(v as FieldScope | 'all')}>
            <SelectTrigger id="cf-filter-scope" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              {SCOPE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Schema list */}
        <div className="space-y-2">
          {filteredSchemas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {schemas.length === 0
                ? 'No custom fields defined yet. Add one below.'
                : 'No custom fields match the selected scope.'}
            </p>
          ) : (
            filteredSchemas.map((field) => (
              <div key={field.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <span className="font-medium">{field.name}</span>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">{field.type}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{field.scope}</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletingId(field.id)}
                  aria-label={`Delete custom field: ${field.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-cf-name" className="text-xs">Name</Label>
            <Input
              id="new-cf-name"
              placeholder="Field name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-32 space-y-1">
            <Label htmlFor="new-cf-type" className="text-xs">Type</Label>
            <Select value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
              <SelectTrigger id="new-cf-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32 space-y-1">
            <Label htmlFor="new-cf-scope" className="text-xs">Scope</Label>
            <Select value={newScope} onValueChange={(v) => setNewScope(v as FieldScope)}>
              <SelectTrigger id="new-cf-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {newType === 'select' && (
            <div className="w-48 space-y-1">
              <Label htmlFor="new-cf-options" className="text-xs">Options (comma-separated)</Label>
              <Input
                id="new-cf-options"
                placeholder="Option A, Option B"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            </div>
          )}
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove custom field?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the field definition from your browser storage. Existing task data is not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && handleDelete(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
