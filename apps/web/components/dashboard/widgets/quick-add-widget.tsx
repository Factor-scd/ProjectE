'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickAddWidget() {
  const router = useRouter();

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Quick Add
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => router.push('/tasks?new=true')}
          >
            New task
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => router.push('/habits?new=true')}
          >
            New habit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => router.push('/notes?new=true')}
          >
            New note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
