'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Plus, FileBarChart, Calendar, Target, TrendingUp, Clock, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Lazy load TipTap report editor (~80KB)
const ReportEditor = dynamic(
  () => import('@/components/reports/report-editor').then((m) => m.ReportEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading editor...</div>
      </div>
    ),
  }
);

// Lazy load report templates
const ReportTemplates = dynamic(
  () => import('@/components/reports/report-templates').then((m) => m.ReportTemplates),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading templates...</div>
      </div>
    ),
  }
);

interface Report {
  id: string;
  title: string;
  content: string;
  report_type: 'weekly' | 'monthly' | 'project' | 'habit' | 'custom';
  date_range_start?: string;
  date_range_end?: string;
  domain: string;
  created: string;
  updated: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Failed'>('Saved');
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pendingSave = useRef<{ id: string; updates: Partial<Report> } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersion = useRef(0);

  useEffect(() => {
    fetchReports();
    fetchDomains();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const d of data.items || []) map.set(d.id, d.name);
        setDomainMap(map);
      }
    } catch {}
  }

  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/reports?sort=-created');
      if (!response.ok) throw new Error('Unable to load reports.');
      const data = await response.json();
      const reportsList = data.items || [];
      setReports(reportsList);
      setSelectedReport((current) => current || reportsList[0] || null);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setError('Unable to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function createReport(overrides?: Partial<Report>) {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled report',
          content: '',
          report_type: 'custom',
          domain: 'personal',
          ...overrides,
        }),
      });
      if (!response.ok) throw new Error('Unable to create report.');
      const newReport = await response.json();
      setReports((current) => [newReport, ...current]);
      setSelectedReport(newReport);
      setShowTemplates(false);
      toast.success('Report created');
    } catch (error) {
      console.error('Failed to create report:', error);
      toast.error('Unable to create report');
    }
  }

  function scheduleSave(reportId: string, updates: Partial<Report>) {
    const version = ++saveVersion.current;
    pendingSave.current = {
      id: reportId,
      updates: { ...(pendingSave.current?.id === reportId ? pendingSave.current.updates : {}), ...updates },
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('Saving');
    saveTimer.current = setTimeout(() => {
      const save = pendingSave.current;
      pendingSave.current = null;
      if (save) updateReport(save.id, save.updates, version);
    }, 700);
  }

  async function updateReport(reportId: string, updates: Partial<Report>, version: number) {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Unable to save report.');
      const updated = await response.json();
      setReports((current) => current.map((report) => (report.id === reportId ? updated : report)));
      if (saveVersion.current === version) setSaveStatus('Saved');
    } catch (error) {
      console.error('Failed to update report:', error);
      if (saveVersion.current === version) setSaveStatus('Failed');
      toast.error('Unable to save report');
    }
  }

  async function deleteReport() {
    if (!reportToDelete) return;
    if (pendingSave.current?.id === reportToDelete.id && saveTimer.current) {
      clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }
    ++saveVersion.current;
    setDeleting(true);
    try {
      const response = await fetch(`/api/reports/${reportToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete report.');
      setReports((current) => current.filter((report) => report.id !== reportToDelete.id));
      setSelectedReport((selected) =>
        selected?.id === reportToDelete.id ? reports.find((report) => report.id !== reportToDelete.id) || null : selected
      );
      setReportToDelete(null);
      toast.success('Report deleted');
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Unable to delete report');
    } finally {
      setDeleting(false);
    }
  }

  function getReportTypeIcon(type: string) {
    switch (type) {
      case 'weekly':
        return <Calendar className="h-4 w-4" />;
      case 'monthly':
        return <Calendar className="h-4 w-4" />;
      case 'project':
        return <Target className="h-4 w-4" />;
      case 'habit':
        return <TrendingUp className="h-4 w-4" />;
      case 'custom':
        return <FileBarChart className="h-4 w-4" />;
      default:
        return <FileBarChart className="h-4 w-4" />;
    }
  }

  if (loading) {
    return <p className="text-muted-foreground" role="status">Loading reports...</p>;
  }

  if (error) {
    return <div className="space-y-3"><p className="text-muted-foreground" role="alert">{error}</p><Button onClick={fetchReports}>Retry</Button></div>;
  }

  if (showTemplates) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="animate-pulse text-sm text-muted-foreground">Loading templates...</div>
          </div>
        }
      >
        <ReportTemplates
          onSelect={(template) => {
            createReport({
              title: template.name,
              report_type: template.type,
              content: template.content,
            });
          }}
          onCancel={() => setShowTemplates(false)}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-1 text-muted-foreground">Step back and see what changed.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            From template
          </Button>
          <Button onClick={() => createReport()}>
            <Plus className="mr-2 h-4 w-4" />
            New report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Reports list */}
        <Card className="max-h-80 overflow-auto lg:h-[calc(100vh-200px)] lg:max-h-none">
          <div className="p-2">
            {reports.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No reports yet</p>
                  <Button className="mt-3" size="sm" onClick={() => createReport()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first report
                  </Button>
                </div>
            ) : (
              <div className="space-y-1">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    aria-label={`Open report: ${report.title}`}
                    aria-current={selectedReport?.id === report.id ? 'true' : undefined}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      selectedReport?.id === report.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-muted-foreground" aria-hidden="true">
                        {getReportTypeIcon(report.report_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{report.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {new Date(report.updated).toLocaleDateString()}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {report.report_type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {domainMap.get(report.domain) || report.domain}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Report editor */}
        <Card className="min-h-[420px] lg:h-[calc(100vh-200px)]">
          {selectedReport ? (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <label htmlFor="report-title" className="sr-only">
                  Report title
                </label>
                <div className="flex items-center gap-3">
                  <input
                  id="report-title"
                  type="text"
                  value={selectedReport.title}
                  onChange={(e) => { const title = e.target.value; setSelectedReport({ ...selectedReport, title }); scheduleSave(selectedReport.id, { title }); }}
                  className="min-w-0 flex-1 text-xl font-semibold outline-none"
                  placeholder="Report title"
                  />
                  <span className="text-xs text-muted-foreground" role="status">{saveStatus}</span>
                  <AlertDialog open={reportToDelete?.id === selectedReport.id} onOpenChange={(open) => !open && setReportToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${selectedReport.title}`} onClick={() => setReportToDelete(selectedReport)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete {reportToDelete?.title}?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this report.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteReport} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete report'}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline">{selectedReport.report_type}</Badge>
                  <Badge variant="outline">{domainMap.get(selectedReport.domain) || selectedReport.domain}</Badge>
                  {selectedReport.date_range_start && selectedReport.date_range_end && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(selectedReport.date_range_start).toLocaleDateString()} -{' '}
                      {new Date(selectedReport.date_range_end).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <div className="animate-pulse text-sm text-muted-foreground">
                        Loading editor...
                      </div>
                    </div>
                  }
                >
                  <ReportEditor
                    content={selectedReport.content}
                    onChange={(content) => { setSelectedReport({ ...selectedReport, content }); scheduleSave(selectedReport.id, { content }); }}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Select a report or create a new one</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
