import { useState, useCallback, useRef, useEffect } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Plus, Trash2, GripVertical, Type, Heading1, Heading2, List, CheckSquare, Code, Image, FileText, ArrowUp, ArrowDown, Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Canvas, CanvasCard, PaginatedResponse } from "@/lib/types";

const BLOCK_TYPES = [
  { id: "text", label: "Text", icon: Type },
  { id: "heading1", label: "Heading 1", icon: Heading1 },
  { id: "heading2", label: "Heading 2", icon: Heading2 },
  { id: "heading3", label: "Heading 3", icon: Heading2 },
  { id: "bullet_list", label: "Bullet List", icon: List },
  { id: "todo", label: "Todo", icon: CheckSquare },
  { id: "code", label: "Code", icon: Code },
  { id: "image", label: "Image", icon: Image },
] as const;

// ─── Block Editor ────────────────────────────────────────────────────────

function BlockEditor({ block, onChange, onDelete, onMoveUp, onMoveDown }: {
  block: { id: string; type: string; content: string };
  onChange: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [showSlash, setShowSlash] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/" && block.content === "") {
      setShowSlash(true);
    }
    if (e.key === "Escape") {
      setShowSlash(false);
    }
  };

  const handleChange = (value: string) => {
    onChange(block.id, value);
    if (value.startsWith("/")) {
      setShowSlash(true);
    } else {
      setShowSlash(false);
    }
  };

  const insertBlockType = (type: string) => {
    onChange(block.id, "");
    // We can't change the type directly in this simple model, so we signal via a custom event
    const event = new CustomEvent("change-block-type", { detail: { id: block.id, type } });
    window.dispatchEvent(event);
    setShowSlash(false);
  };

  const renderEditor = () => {
    switch (block.type) {
      case "heading1":
        return (
          <input
            ref={inputRef as any}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading 1..."
            className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />
        );
      case "heading2":
        return (
          <input
            ref={inputRef as any}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading 2..."
            className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />
        );
      case "heading3":
        return (
          <input
            ref={inputRef as any}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading 3..."
            className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />
        );
      case "todo":
        return (
          <div className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-muted-foreground/30" />
            <input
              value={block.content}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Todo item..."
              className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        );
      case "code":
        return (
          <textarea
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Code..."
            rows={4}
            className="w-full font-mono text-sm bg-muted p-3 rounded border-none outline-none resize-none placeholder:text-muted-foreground/50"
          />
        );
      case "image":
        return (
          <div className="space-y-2">
            <input
              value={block.content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Image URL..."
              className="w-full bg-transparent border-b border-muted-foreground/20 outline-none text-sm placeholder:text-muted-foreground/50"
            />
            {block.content && (
              <img src={block.content} alt="" className="max-w-full h-auto rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
        );
      default:
        return (
          <textarea
            ref={inputRef as any}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type / for commands..."
            rows={2}
            className="w-full bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50"
          />
        );
    }
  };

  return (
    <div className="group relative flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1 shrink-0">
        <button onClick={onMoveUp} className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>
        <button onClick={onMoveDown} className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>
      </div>
      <div className="flex-1 min-w-0">
        {renderEditor()}
      </div>
      <button onClick={() => onDelete(block.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 pt-1">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {showSlash && (
        <div className="absolute left-8 top-full z-50 mt-1 bg-popover border rounded-lg shadow-lg p-1 w-48">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            return (
              <button key={bt.id} onClick={() => insertBlockType(bt.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors">
                <Icon className="h-4 w-4" />
                {bt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Canvas Editor ────────────────────────────────────────────────────────

type Block = { id: string; type: string; content: string };

export function CanvasEditor({ canvas, onBack }: { canvas: Canvas; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<Block[]>(
    canvas.cards?.map((c) => ({ id: c.id, type: c.type, content: c.content })) || [{ id: "new-1", type: "text", content: "" }]
  );
  const [title, setTitle] = useState(canvas.name);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const blockIdCounter = useRef(blocks.length + 1);
  const lastSavedTitle = useRef(canvas.name);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);
  const lastSeen = useRef<{ blocks: Block[]; title: string }>({ blocks, title });

  // Keep latest values reachable from the debounced save without stale closures
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Listen for block type changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setBlocks((prev) => prev.map((b) => b.id === detail.id ? { ...b, type: detail.type } : b));
    };
    window.addEventListener("change-block-type", handler);
    return () => window.removeEventListener("change-block-type", handler);
  }, []);

  // Persist the full block list via the bulk endpoint, then adopt the
  // server-generated ids for newly created blocks (content stays local).
  const persist = useCallback(async () => {
    const currentBlocks = blocksRef.current;
    const currentTitle = titleRef.current;
    setSaveState("saving");
    try {
      const payload = {
        cards: currentBlocks.map((b, i) => ({
          ...(b.id.startsWith("new-") || b.id.startsWith("block-") ? {} : { id: b.id }),
          type: b.type,
          content: b.content,
          zIndex: i,
        })),
      };
      const result = await api.put<{ cards: { id: string }[] }>("/canvas/" + canvas.id + "/cards", payload);
      setBlocks((prev) => {
        if (result.cards.length !== prev.length) return prev;
        let changed = false;
        const next = prev.map((b, i) => {
          const newId = result.cards[i]?.id;
          if (newId && b.id !== newId) {
            changed = true;
            return { ...b, id: newId };
          }
          return b;
        });
        return changed ? next : prev;
      });
      if (currentTitle !== lastSavedTitle.current) {
        await api.patch("/canvas/" + canvas.id, { name: currentTitle });
        lastSavedTitle.current = currentTitle;
      }
      queryClient.invalidateQueries({ queryKey: ["canvas"] });
      isDirty.current = false;
      setSaveState("saved");
    } catch (error) {
      console.error("[canvas] save failed:", error);
      setSaveState("error");
    }
  }, [canvas.id, queryClient]);

  // Debounced autosave: persist shortly after blocks/title stop changing
  useEffect(() => {
    if (lastSeen.current.blocks === blocks && lastSeen.current.title === title) {
      return;
    }
    lastSeen.current = { blocks, title };
    isDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persist();
    }, 800);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [blocks, title, persist]);

  // Flush any unsaved edits when leaving the editor
  useEffect(() => {
    return () => {
      if (isDirty.current) {
        persist();
      }
    };
  }, [persist]);

  const handleSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    persist();
  };

  const handleBlockChange = (id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, content } : b));
  };

  const handleDelete = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= blocks.length - 1) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const addBlock = (type = "text") => {
    blockIdCounter.current++;
    setBlocks((prev) => [...prev, { id: "block-" + blockIdCounter.current, type, content: "" }]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>&larr; Back</Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold border-none bg-transparent h-auto px-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          {saveState === "saving" && <span className="text-xs text-muted-foreground">Saving&hellip;</span>}
          {saveState === "saved" && <span className="text-xs text-muted-foreground">Saved</span>}
          {saveState === "error" && <span className="text-xs text-destructive">Save failed</span>}
          <Button size="sm" onClick={handleSave} disabled={saveState === "saving"}>Save</Button>
        </div>
      </div>
      <Separator />
      <div className="space-y-1">
        {blocks.map((block, idx) => (
          <BlockEditor
            key={block.id}
            block={block}
            onChange={handleBlockChange}
            onDelete={handleDelete}
            onMoveUp={() => handleMoveUp(idx)}
            onMoveDown={() => handleMoveDown(idx)}
          />
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        {BLOCK_TYPES.slice(0, 4).map((bt) => {
          const Icon = bt.icon;
          return (
            <Button key={bt.id} variant="outline" size="sm" onClick={() => addBlock(bt.id)}>
              <Icon className="h-4 w-4 mr-1" />{bt.label}
            </Button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => addBlock("text")}>
          <Plus className="h-4 w-4 mr-1" />Add Block
        </Button>
      </div>
    </div>
  );
}

// ─── Canvas List ──────────────────────────────────────────────────────────

function CanvasList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data, isLoading } = useApiQuery<PaginatedResponse<Canvas>>(["canvas"], "/canvas");
  const canvases = data?.items || [];

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Canvas>("/canvas", { name }),
    onSuccess: (canvas) => {
      queryClient.invalidateQueries({ queryKey: ["canvas"] });
      setCreateOpen(false);
      setNewName("");
      navigate({ to: "/canvas/$id", params: { id: canvas.id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/canvas/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["canvas"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canvas</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Canvas</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Canvas</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="canvas-name">Name</Label>
                <Input id="canvas-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Canvas name" />
              </div>
              <Button onClick={() => createMutation.mutate(newName)} disabled={!newName.trim() || createMutation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading canvases...</div>
      ) : canvases.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No canvases yet. Create your first one!</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {canvases.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate({ to: "/canvas/$id", params: { id: c.id } })}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold truncate">{c.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{c.mode}</Badge>
                  <span className="text-xs text-muted-foreground">{c.cards?.length || 0} blocks</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/canvas",
  component: CanvasList,
});
