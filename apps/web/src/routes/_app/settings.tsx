import { useState, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Plus, Trash2, Pencil, Palette, Sun, Moon, Monitor, Type, Maximize, Sidebar, Eye, Globe, Tag, List, Key, Bot, Webhook, Upload, Download, AlertCircle, Check, X, RefreshCw, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useThemeStore } from "@/lib/stores/use-theme-store";
import { cn } from "@/lib/utils";
import type { Domain, CustomField, Webhook as WebhookType, ErrorLog, Agent, PaginatedResponse } from "@/lib/types";

const SETTINGS_TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "custom-fields", label: "Custom Fields", icon: List },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Key },
  { id: "agents", label: "Agents & Permissions", icon: Bot },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "import-export", label: "Import & Export", icon: Upload },
  { id: "error-log", label: "Error Log", icon: AlertCircle },
] as const;

const ACCENT_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Rose", value: "#e11d48" },
];

const SHORTCUTS_MAP: Record<string, string> = {
  "Cmd+K": "Command palette",
  "g+t": "Go to Tasks",
  "g+h": "Go to Habits",
  "g+p": "Go to Projects",
  "g+n": "Go to Notes",
  "g+c": "Go to Calendar",
  "g+d": "Go to Dashboard",
  "g+s": "Go to Settings",
  "g+a": "Go to Analytics",
  "n": "New task / note (context dependent)",
  "?": "Show keyboard shortcuts help",
};

// ─── Appearance Tab ──────────────────────────────────────────────────────

function AppearanceTab() {
  const { mode, setMode } = useThemeStore();
  const [accent, setAccent] = useState(localStorage.getItem("accent-color") || "#3b82f6");
  const [fontSize, setFontSize] = useState(localStorage.getItem("font-size") || "normal");
  const [density, setDensity] = useState(localStorage.getItem("density") || "comfortable");
  const [sidebarPos, setSidebarPos] = useState(localStorage.getItem("sidebar-position") || "left");
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem("reduced-motion") === "true");

  useEffect(() => { localStorage.setItem("accent-color", accent); document.documentElement.style.setProperty("--accent-color", accent); }, [accent]);
  useEffect(() => { localStorage.setItem("font-size", fontSize); document.documentElement.style.fontSize = fontSize === "large" ? "18px" : fontSize === "small" ? "13px" : "16px"; }, [fontSize]);
  useEffect(() => { localStorage.setItem("density", density); }, [density]);
  useEffect(() => { localStorage.setItem("sidebar-position", sidebarPos); }, [sidebarPos]);
  useEffect(() => { localStorage.setItem("reduced-motion", String(reducedMotion)); document.documentElement.classList.toggle("reduce-motion", reducedMotion); }, [reducedMotion]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Theme</h3>
        <div className="flex gap-3">
          {[
            { id: "light", icon: Sun, label: "Light" },
            { id: "dark", icon: Moon, label: "Dark" },
            { id: "system", icon: Monitor, label: "System" },
          ].map((t) => (
            <button key={t.id} onClick={() => setMode(t.id as "light" | "dark" | "system")}
              className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors", mode === t.id ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30")}>
              <t.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-3">Accent Color</h3>
        <div className="flex gap-3">
          {ACCENT_COLORS.map((c) => (
            <button key={c.value} onClick={() => setAccent(c.value)}
              className={cn("w-10 h-10 rounded-full border-2 transition-all", accent === c.value ? "border-foreground scale-110" : "border-transparent")}
              style={{ backgroundColor: c.value }} aria-label={c.name} />
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-3">Font Size</h3>
        <Select value={fontSize} onValueChange={setFontSize}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-3">Density</h3>
        <Select value={density} onValueChange={setDensity}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="spacious">Spacious</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-3">Sidebar Position</h3>
        <Select value={sidebarPos} onValueChange={setSidebarPos}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reduced Motion</h3>
          <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
        </div>
        <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
      </div>
    </div>
  );
}

// ─── Domains Tab ─────────────────────────────────────────────────────────

function DomainsTab() {
  const queryClient = useQueryClient();
  const { data } = useApiQuery<PaginatedResponse<Domain>>(["domains"], "/domains");
  const domains = data?.items || [];
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post<Domain>("/domains", { name: n }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["domains"] }); setCreateOpen(false); setName(""); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/domains/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domains"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Domains</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Domain</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Domain</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="domain-name">Name</Label>
                <Input id="domain-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Domain name" />
              </div>
              <Button onClick={() => createMutation.mutate(name)} disabled={!name.trim() || createMutation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {domains.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.slug}</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Domain</AlertDialogTitle><AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate(d.id)} className="bg-destructive">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tags Tab ────────────────────────────────────────────────────────────

function TagsTab() {
  const queryClient = useQueryClient();
  const { data } = useApiQuery<PaginatedResponse<any>>(["tags"], "/tags");
  const tags = data?.items || [];
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/tags", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); setCreateOpen(false); setName(""); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/tags/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tags</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Tag</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Tag</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tag-name">Name</Label>
                <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" />
              </div>
              <div>
                <Label htmlFor="tag-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input id="tag-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 p-1" />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
              <Button onClick={() => createMutation.mutate({ name, color })} disabled={!name.trim() || createMutation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm group">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color || "#3b82f6" }} />
            <span>{t.name}</span>
            <button onClick={() => deleteMutation.mutate(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Fields Tab ────────────────────────────────────────────────────

function CustomFieldsTab() {
  const queryClient = useQueryClient();
  const [entityFilter, setEntityFilter] = useState("");
  const { data } = useApiQuery<PaginatedResponse<CustomField>>(["custom-fields", entityFilter], "/custom-fields" + (entityFilter ? "?entity=" + entityFilter : ""));
  const fields = data?.items || [];
  const [createOpen, setCreateOpen] = useState(false);
  const [editField, setEditField] = useState<CustomField | null>(null);
  const [form, setForm] = useState({ name: "", type: "text", entityType: "tasks", required: false, options: "" });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post<CustomField>("/custom-fields", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["custom-fields"] }); setCreateOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: any }) => api.patch<CustomField>("/custom-fields/" + id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["custom-fields"] }); setEditField(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/custom-fields/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-fields"] }),
  });

  const handleSave = () => {
    const data: any = { name: form.name, type: form.type, entityType: form.entityType, required: form.required };
    if (form.type === "select" || form.type === "multi_select") data.options = form.options.split(",").map((s) => s.trim()).filter(Boolean);
    if (editField) updateMutation.mutate({ id: editField.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Fields</h3>
        <div className="flex gap-2">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All entities</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="habits">Habits</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Field</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Custom Field</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="multi_select">Multi Select</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select></div>
                <div><Label>Entity Type</Label><Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tasks">Tasks</SelectItem>
                    <SelectItem value="habits">Habits</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                  </SelectContent>
                </Select></div>
                {(form.type === "select" || form.type === "multi_select") && (
                  <div><Label>Options (comma-separated)</Label><Input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="Option 1, Option 2" /></div>
                )}
                <div className="flex items-center gap-2"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /><Label>Required</Label></div>
                <Button onClick={handleSave} disabled={!form.name.trim()}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.type} &middot; {f.entityType}{f.required ? " &middot; Required" : ""}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditField(f); setForm({ name: f.name, type: f.type, entityType: f.entityType, required: f.required, options: f.options?.join(", ") || "" }); }}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Field</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(f.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
      {editField && (
        <Dialog open={!!editField} onOpenChange={(o) => { if (!o) setEditField(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Custom Field</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="multi_select">Multi Select</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select></div>
              {(form.type === "select" || form.type === "multi_select") && (
                <div><Label>Options (comma-separated)</Label><Input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} /></div>
              )}
              <div className="flex items-center gap-2"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /><Label>Required</Label></div>
              <Button onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Keyboard Shortcuts Tab ────────────────────────────────────────────────

function ShortcutsTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
      <div className="space-y-1">
        {Object.entries(SHORTCUTS_MAP).map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
            <span className="text-sm">{desc}</span>
            <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border">{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Agents & Permissions Tab ────────────────────────────────────────────

function AgentsTab() {
  const queryClient = useQueryClient();
  const { data } = useApiQuery<PaginatedResponse<Agent>>(["agents"], "/agents");
  const agents = data?.items || [];
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permissionTier: "read_only" });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post<Agent>("/agents", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); setCreateOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/agents/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Agents &amp; Permissions</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Agent</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Agent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Permission Tier</Label><Select value={form.permissionTier} onValueChange={(v) => setForm({ ...form, permissionTier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_access">Full Access</SelectItem>
                  <SelectItem value="read_only">Read Only</SelectItem>
                  <SelectItem value="content_creator">Content Creator</SelectItem>
                  <SelectItem value="task_manager">Task Manager</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select></div>
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.permissionTier.replace(/_/g, " ")} &middot; {a.status}</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Agent</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Webhooks Tab ────────────────────────────────────────────────────────

function WebhooksTab() {
  const queryClient = useQueryClient();
  const { data } = useApiQuery<PaginatedResponse<WebhookType>>(["webhooks"], "/webhooks");
  const webhooks = data?.items || [];
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: "task.created,note.created" });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post<Webhook>("/webhooks", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhooks"] }); setCreateOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/webhooks/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
  const testMutation = useMutation({
    mutationFn: (id: string) => api.post("/webhooks/" + id + "/test", {}),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Webhooks</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Webhook</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Webhook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" /></div>
              <div><Label>Events (comma-separated)</Label><Input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} /></div>
              <Button onClick={() => createMutation.mutate({ name: form.name, url: form.url, events: form.events.split(",").map((s) => s.trim()) })} disabled={!form.name.trim() || !form.url.trim() || createMutation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {webhooks.map((w) => (
          <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{w.name}</p>
              <p className="text-xs text-muted-foreground truncate">{w.url}</p>
              <div className="flex gap-1 mt-1">
                {w.events.slice(0, 3).map((e) => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="outline" size="sm" className="h-8" onClick={() => testMutation.mutate(w.id)} disabled={testMutation.isPending}>
                <TestTube className="h-3.5 w-3.5 mr-1" />Test
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Webhook</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(w.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Import & Export Tab ─────────────────────────────────────────────────

function ImportExportTab() {
  const queryClient = useQueryClient();
  const [importData, setImportData] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportCollections, setExportCollections] = useState<string[]>(["tasks", "habits", "projects", "notes"]);

  const importMutation = useMutation({
    mutationFn: (data: any) => api.post("/import", data),
    onSuccess: (res) => { setImportResult(res); queryClient.invalidateQueries(); },
  });

  const handleExport = async () => {
    try {
      const data = await api.post<any>("/export", { collections: exportCollections });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-e-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const toggleCollection = (c: string) => {
    setExportCollections((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Import</h3>
        <p className="text-sm text-muted-foreground mb-3">Paste JSON data to import. Format: {"{"} "version": "1.0", "tasks": [...], "habits": [...], "projects": [...], "notes": [...] {"}"}</p>
        <Textarea value={importData} onChange={(e) => setImportData(e.target.value)} placeholder='{"version": "1.0", "tasks": [...]}' rows={6} className="font-mono text-sm" />
        <Button className="mt-2" onClick={() => { try { importMutation.mutate(JSON.parse(importData)); } catch { setImportResult({ success: false, error: "Invalid JSON" }); } }} disabled={!importData.trim() || importMutation.isPending}>
          <Upload className="h-4 w-4 mr-2" />Import
        </Button>
        {importResult && (
          <div className={cn("mt-3 p-3 rounded-lg text-sm", importResult.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>
            {importResult.success ? "Imported " + importResult.imported + " items" : "Import failed: " + (importResult.error || "Unknown error")}
          </div>
        )}
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-3">Export</h3>
        <div className="space-y-3">
          <div>
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Collections</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["tasks", "habits", "projects", "notes", "tags", "agents", "webhooks"].map((c) => (
                <button key={c} onClick={() => toggleCollection(c)}
                  className={cn("px-3 py-1.5 rounded-full border text-sm transition-colors", exportCollections.includes(c) ? "bg-primary text-primary-foreground border-primary" : "hover:border-muted-foreground/30")}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleExport}><Download className="h-4 w-4 mr-2" />Download Export</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Error Log Tab ───────────────────────────────────────────────────────

function ErrorLogTab() {
  const [level, setLevel] = useState("");
  const { data } = useApiQuery<PaginatedResponse<ErrorLog>>(["error-log", level], "/error-log" + (level ? "?level=" + level : ""));
  const errors = data?.items || [];
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const clearMutation = useMutation({
    mutationFn: () => api.delete("/error-log"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["error-log"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Error Log</h3>
        <div className="flex gap-2">
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All levels</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />Clear All
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No errors logged</p>
        ) : (
          errors.map((e) => (
            <div key={e.id} className="border rounded-lg">
              <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", e.level === "error" ? "bg-red-500" : e.level === "warn" ? "bg-amber-500" : "bg-blue-500")} />
                  <span className="text-sm truncate">{e.message}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{new Date(e.createdAt).toLocaleString()}</span>
              </button>
              {expanded === e.id && (
                <div className="px-3 pb-3 space-y-2">
                  <Separator />
                  {e.stack && <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-auto max-h-40">{e.stack}</pre>}
                  {e.context && <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(e.context, null, 2)}</pre>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("appearance");

  return (
    <div className="flex gap-6 h-[calc(100vh-5rem)]">
      {/* Sidebar tabs */}
      <div className="w-56 shrink-0 space-y-1">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <Separator orientation="vertical" />
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full pr-4">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "domains" && <DomainsTab />}
          {activeTab === "tags" && <TagsTab />}
          {activeTab === "custom-fields" && <CustomFieldsTab />}
          {activeTab === "shortcuts" && <ShortcutsTab />}
          {activeTab === "agents" && <AgentsTab />}
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "import-export" && <ImportExportTab />}
          {activeTab === "error-log" && <ErrorLogTab />}
        </ScrollArea>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});
