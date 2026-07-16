'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ErrorLog {
  id: string;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created: string;
}

export default function ErrorLogPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErrors();
  }, []);

  async function fetchErrors() {
    try {
      const response = await fetch('/api/error-logs?limit=50');
      if (response.ok) {
        const data = await response.json();
        setErrors(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function clearErrors() {
    try {
      const response = await fetch('/api/error-logs', { method: 'DELETE' });
      if (response.ok) {
        setErrors([]);
      }
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Log</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Error Log</CardTitle>
            <CardDescription>
              Recent errors from the application (auto-purged after 30 days)
            </CardDescription>
          </div>
          {errors.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearErrors} aria-label="Clear all error logs">
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No errors logged
          </p>
        ) : (
          <div className="space-y-3">
            {errors.map((error) => (
              <div
                key={error.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                    <span className="text-sm font-medium">{error.level}</span>
                    <span className="text-xs text-muted-foreground">
                      {error.source}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(error.created).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{error.message}</p>
                {error.metadata &&
                  Object.keys(error.metadata).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground" role="button">
                        Details
                      </summary>
                      <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto">
                        {JSON.stringify(error.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
