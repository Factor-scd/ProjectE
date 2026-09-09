import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, X } from "lucide-react";
import type { Task, State, StateGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  projectStates: State[];
  onClearSelection: () => void;
  onComplete: () => void;
  onBatchUpdate: (updates: Partial<Task>) => void;
  onBatchDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  projectStates,
  onClearSelection,
  onComplete,
  onBatchUpdate,
  onBatchDelete,
}: BulkActionBarProps) {
  const [priority, setPriority] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");
  const [tagName, setTagName] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    if (value) {
      onBatchUpdate({ priority: value as Task["priority"] });
    }
  };

  const handleStateChange = (value: string) => {
    setStateId(value);
    if (value) {
      onBatchUpdate({ stateId: value || null });
    }
  };

  const handleTagAdd = () => {
    if (tagName.trim()) {
      onBatchUpdate({ tags: [{ id: "", name: tagName.trim(), color: null }] });
      setTagName("");
      tagInputRef.current?.focus();
    }
  };

  const handleDeleteConfirm = () => {
    onBatchDelete();
    setDeleteDialogOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-lg rounded-lg bg-card border px-4 py-2 flex items-center gap-2">
      <span className="text-sm font-medium mr-2">{selectedCount} selected</span>
      
      <Button variant="outline" size="sm" onClick={onComplete}>
        Complete
      </Button>

      <Select value={priority} onValueChange={handlePriorityChange}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      {projectStates.length > 0 && (
        <Select value={stateId} onValueChange={handleStateChange}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            {projectStates.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || "#94a3b8" }} />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-1">
        <Input
          ref={tagInputRef}
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder="Tag"
          className="w-24 h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleTagAdd();
            }
          }}
        />
        <Button variant="ghost" size="sm" onClick={handleTagAdd} className="h-8 px-2">
          +
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} tasks? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-8 px-2 ml-2">
        <X className="h-4 w-4 mr-1" />
        Esc
      </Button>
    </div>
  );
}
