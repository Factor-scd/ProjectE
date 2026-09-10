import { useState, useCallback } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { Plus, Trash2, FileText, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterComponent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  type: "task" | "note";
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "project-e-templates";

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"task" | "note">("task");
  const [newContent, setNewContent] = useState("");

  const handleCreate = useCallback(() => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Template name is required");
      return;
    }

    const template: Template = {
      id: crypto.randomUUID(),
      name: trimmedName,
      type: newType,
      content: newContent,
      createdAt: new Date().toISOString(),
    };

    const updated = [template, ...templates];
    setTemplates(updated);
    saveTemplates(updated);
    setNewName("");
    setNewType("task");
    setNewContent("");
    setOpen(false);
    toast.success("Template created");
  }, [newName, newType, newContent, templates]);

  const handleDelete = useCallback(
    (id: string) => {
      const updated = templates.filter((t) => t.id !== id);
      setTemplates(updated);
      saveTemplates(updated);
      toast.success("Template deleted");
    },
    [templates]
  );

  const handleUse = useCallback(
    (template: Template) => {
      navigator.clipboard.writeText(template.content).catch(() => {});
      if (template.type === "task") {
        navigate({ to: "/tasks" });
      } else {
        navigate({ to: "/notes" });
      }
      toast.success(`Template content copied — paste it when creating your ${template.type}`);
    },
    [navigate]
  );

  return (
    <div className="flex flex-col h-auto min-h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">Templates</h1>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {templates.length}
          </Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g. Weekly Review"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "task" | "note")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-content">Content</Label>
                <Textarea
                  id="template-content"
                  placeholder="Template content..."
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {templates.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-indigo-400" />
              <p className="text-sm text-muted-foreground">No templates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create reusable task or note templates
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {templates.map((template) => (
              <Card key={template.id} className="border rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{template.name}</span>
                        <Badge
                          variant={template.type === "task" ? "default" : "secondary"}
                          className="font-mono text-[10px] shrink-0"
                        >
                          {template.type === "task" ? "Task" : "Note"}
                        </Badge>
                      </div>
                      {template.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {template.content.slice(0, 100)}
                          {template.content.length > 100 ? "..." : ""}
                        </p>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUse(template)}
                        title="Use template"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Delete template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{template.name}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooterComponent>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(template.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooterComponent>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/templates",
  component: TemplatesPage,
});
