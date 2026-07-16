'use client';

import { useState, useEffect } from 'react';
import { Download, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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

// ── Types ──────────────────────────────────────────────────────────────────

interface CollectionInfo {
  name: string;
  label: string;
}

interface ImportResultItem {
  collection: string;
  imported: number;
  failed: number;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  results: ImportResultItem[];
}

const DEFAULT_COLLECTIONS: CollectionInfo[] = [
  { name: 'tasks', label: 'Tasks' },
  { name: 'habits', label: 'Habits' },
  { name: 'projects', label: 'Projects' },
  { name: 'notes', label: 'Notes' },
  { name: 'reports', label: 'Reports' },
  { name: 'milestones', label: 'Milestones' },
  { name: 'domains', label: 'Domains' },
  { name: 'tags', label: 'Tags' },
  { name: 'agents', label: 'Agents' },
  { name: 'webhooks', label: 'Webhooks' },
];

// ── Main Component ─────────────────────────────────────────────────────────

export function SettingsImportExport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    DEFAULT_COLLECTIONS.map((c) => c.name)
  );
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress while fetching
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: selectedCollections }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();
      setExportProgress(100);

      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-e-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setPendingImportFile(file);
    setImportResult(null);
    setConfirmImport(true);
  }

  async function executeImport() {
    if (!pendingImportFile) return;

    setConfirmImport(false);
    setImporting(true);
    setImportProgress(0);

    try {
      const text = await pendingImportFile.text();
      const data = JSON.parse(text);

      if (!data.version) {
        toast.error('Invalid file — missing version field. Is this a valid Project E export?');
        return;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 5, 90));
      }, 300);

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Import failed');
        return;
      }

      const result: ImportResult = await response.json();
      setImportProgress(100);
      setImportResult(result);

      if (result.success) {
        toast.success(`Import complete: ${result.imported} records imported`);
      } else {
        toast.warning(
          `Import finished with errors: ${result.imported} imported, ${result.failed} failed`
        );
      }
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error('Failed to parse import file. Please check the format.');
    } finally {
      setImporting(false);
      setPendingImportFile(null);
    }
  }

  // ── Collection toggle ─────────────────────────────────────────────────────

  function toggleCollection(name: string) {
    setSelectedCollections((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  function toggleAllCollections() {
    if (selectedCollections.length === DEFAULT_COLLECTIONS.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(DEFAULT_COLLECTIONS.map((c) => c.name));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import & Export</CardTitle>
        <CardDescription>Backup your data or restore from a previous export.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Export Section ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Export data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Download your data as a JSON file. Choose which collections to include.
          </p>

          {/* Collection selection */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedCollections.length === DEFAULT_COLLECTIONS.length}
                onCheckedChange={toggleAllCollections}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Select all
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {DEFAULT_COLLECTIONS.map((collection) => (
                <div key={collection.name} className="flex items-center gap-2">
                  <Checkbox
                    id={`export-${collection.name}`}
                    checked={selectedCollections.includes(collection.name)}
                    onCheckedChange={() => toggleCollection(collection.name)}
                  />
                  <Label
                    htmlFor={`export-${collection.name}`}
                    className="text-sm text-muted-foreground"
                  >
                    {collection.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="mt-4 space-y-2">
              <Progress value={exportProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Exporting... {exportProgress}%</p>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={exporting || selectedCollections.length === 0}
            className="mt-4"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? 'Exporting...' : 'Export to JSON'}
          </Button>
        </div>

        {/* ── Import Section ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Import data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Restore from a previously exported JSON file. All existing data will be supplemented.
          </p>

          {/* Progress */}
          {importing && (
            <div className="mt-4 space-y-2">
              <Progress value={importProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Importing... {importProgress}%</p>
            </div>
          )}

          {/* Import results */}
          {importResult && (
            <div className="mt-4 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-sm font-medium">
                  {importResult.imported} imported, {importResult.failed} failed
                </span>
              </div>

              {importResult.results.length > 0 && (
                <div className="mt-3 space-y-2">
                  {importResult.results.map((r) => (
                    <div key={r.collection} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{r.collection}</span>
                      <span>
                        {r.imported} ok
                        {r.failed > 0 && (
                          <span className="text-destructive">, {r.failed} failed</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {importResult.results.some((r) => r.errors.length > 0) && (
                <div className="mt-3">
                <p className="text-xs font-medium text-destructive">Errors:</p>
                <div className="mt-1 max-h-32 overflow-auto" role="list" aria-label="Import errors">
                    {importResult.results
                      .flatMap((r) => r.errors)
                      .slice(0, 10)
                      .map((error, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {error}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="mt-4 inline-block">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
            />
            <Button variant="outline" disabled={importing} asChild>
              <span>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {importing ? 'Importing...' : 'Import from JSON'}
              </span>
            </Button>
          </label>
        </div>

        {/* ── Import Confirmation Dialog ─────────────────────────────────────── */}
        <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm import</AlertDialogTitle>
              <AlertDialogDescription>
                This will import data from the selected file. Existing records will not be
                overwritten, but new records will be created for each item in the file. Are you sure
                you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingImportFile(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={executeImport}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
