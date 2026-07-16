'use client';

import { Flame, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface HabitCardProps {
  habit: {
    id: string;
    name: string;
    description?: string;
    frequency: 'daily' | 'weekly' | 'custom';
    current_streak: number;
    best_streak: number;
    score: number;
    completion_mode: 'quick' | 'detailed';
    domain: string;
    logged_today: boolean;
  };
  onComplete: () => void;
}

export function HabitCard({ habit, onComplete }: HabitCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{habit.name}</CardTitle>
            {habit.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {habit.description}
              </p>
            )}
          </div>
          <Badge variant="outline" className="ml-2 shrink-0">
            {habit.domain}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streak info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <span className="font-semibold">{habit.current_streak}</span>
            <span className="text-muted-foreground">day streak</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Best: {habit.best_streak}
          </span>
        </div>

        {/* Score */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Score</span>
            <span className="font-semibold">{habit.score}/100</span>
          </div>
          <Progress value={habit.score} className="h-2" />
        </div>

        {/* Frequency badge */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {habit.frequency}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {habit.completion_mode}
          </Badge>
        </div>

        {/* Complete button */}
        <Button
          onClick={onComplete}
          variant={habit.logged_today ? 'outline' : 'default'}
          className="w-full"
          disabled={habit.logged_today}
        >
          {habit.logged_today ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              Completed today
            </>
          ) : (
            <>
              <Circle className="mr-2 h-4 w-4" />
              Mark complete
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
