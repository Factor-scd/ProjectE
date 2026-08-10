import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TagManager } from "@/components/entities/tag-manager";
import { ArrowLeft, Flame, Calendar, Clock } from "lucide-react";
import type { Habit, HabitCompletion } from "@/lib/types";
import { format, parseISO } from "date-fns";

function HabitDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: habit, isLoading } = useApiQuery<Habit>(["habit", id], "/habits/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!habit) return <div className="p-8 text-center text-muted-foreground">Habit not found</div>;

  const completions = habit.recentCompletions || [];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/habits" })} className="w-fit">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Habits
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-orange-500" />
            <CardTitle className="text-2xl">{habit.name}</CardTitle>
            <Badge variant={habit.active ? "default" : "secondary"}>{habit.active ? "Active" : "Inactive"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {format(parseISO(habit.createdAt), "MMM d, yyyy HH:mm")}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {format(parseISO(habit.updatedAt), "MMM d, yyyy HH:mm")}</span>
          </div>
          {habit.description && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{habit.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{habit.streakCount}</p>
              <p className="text-xs text-muted-foreground">Current Streak</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{habit.bestStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{habit.frequency}</p>
              <p className="text-xs text-muted-foreground">Frequency</p>
            </div>
          </div>
          <Separator />
          <TagManager entityType="habit" entityId={habit.id} tags={habit.tags || []} />
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent Completions</h3>
            {completions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completions yet</p>
            ) : (
              <div className="space-y-1">
                {completions.slice(0, 10).map((c: HabitCompletion) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm py-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{format(parseISO(c.date), "MMM d, yyyy")}</span>
                    {c.value > 1 && <Badge variant="secondary">{c.value}x</Badge>}
                    {c.mood && <span className="text-xs text-muted-foreground">Mood: {c.mood}/5</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "habits/$id",
  component: HabitDetail,
});
