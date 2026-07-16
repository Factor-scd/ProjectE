'use client';

import { useEffect, useState, Suspense } from 'react';
import { Plus, FileBarChart, Calendar, Target, TrendingUp, Clock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const response = await fetch('/api/reports?sort=-created');
      if (response.ok) {
        const data = await response.json();
        const reportsList = data.items || [];
        setReports(reportsList);
        if (reportsList.length > 0 && !selectedReport) {
          setSelectedReport(reportsList[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
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
      if (response.ok) {
        const newReport = await response.json();
        setReports([newReport, ...reports]);
        setSelectedReport(newReport);
        setShowTemplates(false);
      }
    } catch (error) {
      console.error('Failed to create report:', error);
    }
  }

  async function updateReport(reportId: string, updates: Partial<Report>) {
    try {
      await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to update report:', error);
    }
  }

  async function deleteReport(reportId: string) {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
      const updatedReports = reports.filter((r) => r.id !== reportId);
      setReports(updatedReports);
      if (selectedReport?.id === reportId) {
        setSelectedReport(updatedReports[0] || null);
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
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
    return <p className="text-muted-foreground">Loading reports...</p>;
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
      <div className="mb-6 flex items-center justify-between">
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
        <Card className="h-[calc(100vh-200px)] overflow-auto">
          <div className="p-2">
            {reports.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No reports yet
              </p>
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
                            {report.domain}
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
        <Card className="h-[calc(100vh-200px)]">
          {selectedReport ? (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <label htmlFor="report-title" className="sr-only">
                  Report title
                </label>
                <input
                  id="report-title"
                  type="text"
                  value={selectedReport.title}
                  onChange={(e) =>
                    setSelectedReport({ ...selectedReport, title: e.target.value })
                  }
                  onBlur={() =>
                    updateReport(selectedReport.id, { title: selectedReport.title })
                  }
                  className="w-full text-xl font-semibold outline-none"
                  placeholder="Report title"
                />
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline">{selectedReport.report_type}</Badge>
                  <Badge variant="outline">{selectedReport.domain}</Badge>
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
                    onChange={(content) =>
                      setSelectedReport({ ...selectedReport, content })
                    }
                    onBlur={() =>
                      updateReport(selectedReport.id, { content: selectedReport.content })
                    }
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
