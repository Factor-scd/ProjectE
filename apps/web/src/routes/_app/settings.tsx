import { useState, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Plus, Trash2, Pencil, Palette, Sun, Moon, Monitor, Type, Maximize, Sidebar, Eye, Globe, Tag, List, Key, Bot, Webhook, Upload, Download, AlertCircle, Check, X, RefreshCw, TestTube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useThemeStore, ACCENT_PALETTE, type ThemeMode, type AccentColor } from "@/lib/stores/use-theme-store";
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

const ACCENT_COLORS = Object.entries(ACCENT_PALETTE).map(([key, val]) => ({
  name: val.name,
  value: key as AccentColor,
}));

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
  const { mode, setMode, accent, setAccent } = useThemeStore();
  const [fontSize, setFontSize] = useState(localStorage.getItem("font-size") || "normal");
  const [density, setDensity] = useState(localStorage.getItem("density") || "comfortable");
  const [sidebarPos, setSidebarPos] = useState(localStorage.getItem("sidebar-position") || "left");
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem("reduced-motion") === "true");

  useEffect(() => { localStorage.setItem("font-size", fontSize); document.documentElement.style.fontSize = fontSize === "large" ? "18px" : fontSize === "small" ? "13px" : "16px"; }, [fontSize]);
  // Density actually changes spacing now: toggle the density-* classes on <html>
  // (see the density utilities + --density-scale in index.css) and persist.
  useEffect(() => {
    localStorage.setItem("density", density);
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-spacious");
    if (density === "compact") root.classList.add("density-compact");
    if (density === "spacious") root.classList.add("density-spacious");
  }, [density]);
  // sidebarPos actually repositions the sidebar now: persist it and tell the
  // app shell (sidebar.tsx) to re-read it without a reload.
  useEffect(() => {
    localStorage.setItem("sidebar-position", sidebarPos);
    window.dispatchEvent(new CustomEvent("sidebar-position-change", { detail: sidebarPos }));
  }, [sidebarPos]);
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
            <button key={t.id} onClick={() => setMode(t.id as ThemeMode)}
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
          {ACCENT_COLORS.map((c) => {
            const palette = ACCENT_PALETTE[c.value];
            return (
              <button key={c.value} onClick={() => setAccent(c.value)}
                className={cn("w-10 h-10 rounded-full border-2 transition-all", accent === c.value ? "border-foreground scale-110" : "border-transparent")}
                style={{ backgroundColor: "hsl(" + palette.hsl + ")" }} aria-label={c.name} />
            );
          })}
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
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "active",
    permissionTier: "read_only",
    customPermissions: "",
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post<Agent>("/agents", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); setCreateOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: any }) => api.patch<Agent>("/agents/" + id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["agents"] }); setEditAgent(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/agents/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  const openEdit = (a: Agent) => {
    setEditAgent(a);
    setEditForm({
      name: a.name,
      description: a.description || "",
      status: a.status,
      permissionTier: a.permissionTier,
      customPermissions: (a.customPermissions || []).join(", "),
    });
  };

  const handleSaveEdit = () => {
    if (!editAgent) return;
    const data: any = {
      name: editForm.name.trim(),
      description: editForm.description || null,
      status: editForm.status,
      permissionTier: editForm.permissionTier,
    };
    // customPermissions only apply to the "custom" tier; clear them otherwise so
    // a downgrade doesn't leave stale permissions in the database.
    data.customPermissions = editForm.permissionTier === "custom"
      ? editForm.customPermissions.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    updateMutation.mutate({ id: editAgent.id, data });
  };

  const permissionLabels: Record<string, string> = {
    full_access: "Full Access",
    read_only: "Read Only",
    content_creator: "Content Creator",
    task_manager: "Task Manager",
    custom: "Custom",
  };

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
                  {Object.entries(permissionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
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
            <div className="min-w-0">
              <p className="font-medium truncate">{a.name}</p>
              {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
              <p className="text-xs text-muted-foreground">
                {permissionLabels[a.permissionTier] || a.permissionTier} &middot; {a.status}
              </p>
              {a.permissionTier === "custom" && a.customPermissions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {a.customPermissions.map((p) => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} aria-label={"Edit " + a.name}><Pencil className="h-4 w-4" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Agent</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
      {editAgent && (
        <Dialog open={!!editAgent} onOpenChange={(o) => { if (!o) setEditAgent(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Agent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div><Label>Status</Label><Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select></div>
              <div><Label>Permission Tier</Label><Select value={editForm.permissionTier} onValueChange={(v) => setEditForm({ ...editForm, permissionTier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(permissionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select></div>
              {editForm.permissionTier === "custom" && (
                <div><Label>Custom Permissions (comma-separated)</Label><Input value={editForm.customPermissions} onChange={(e) => setEditForm({ ...editForm, customPermissions: e.target.value })} placeholder="tasks.write, notes.read, ..." /></div>
              )}
              {editAgent.apiKey && (
                <div>
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input value={editAgent.apiKey} readOnly className="font-mono text-xs" aria-label="Agent API key" />
                    <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { navigator.clipboard.writeText(editAgent.apiKey as string); toast.success("API key copied"); }}>
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Shown only here — store it securely before rotating.</p>
                </div>
              )}
              <Button onClick={handleSaveEdit} disabled={!editForm.name.trim() || updateMutation.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
    mutationFn: (d: any) => api.post<WebhookType>("/webhooks", d),
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

// CSV export helpers. The export API always returns JSON; when the user picks
// CSV we convert each collection client-side. Nested values (tags arrays,
// customFields objects, etc.) are JSON-stringified into a single cell.

/** Escape a single CSV field per RFC 4180: wrap in quotes when needed, double inner quotes. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Render one cell: null/undefined → empty, scalars pass through, objects/arrays get JSON-stringified. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return csvEscape(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return csvEscape(JSON.stringify(value));
}

/** Build a CSV document (header + one row per object) from an array of flat rows. */
function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ImportExportTab() {
  const queryClient = useQueryClient();
  const [importData, setImportData] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportCollections, setExportCollections] = useState<string[]>(["tasks", "habits", "projects", "notes"]);

  const importMutation = useMutation({
    mutationFn: (data: any) => api.post<any>("/import", data),
    onSuccess: (res) => {
      setImportResult(res);
      queryClient.invalidateQueries();
      if (res.success) {
        toast.success("Imported " + res.imported + " items");
      } else {
        toast.error("Imported " + (res.imported ?? 0) + " items, " + (res.failed ?? 0) + " failed");
      }
    },
    onError: (err) => {
      const message = err.message || "Import failed";
      setImportResult({ success: false, error: message });
      toast.error(message);
    },
  });

  const handleImport = () => {
    let parsed: any;
    try {
      parsed = JSON.parse(importData);
    } catch {
      const message = "Invalid JSON in import data";
      setImportResult({ success: false, error: message });
      toast.error(message);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const message = "Invalid format: expected an object with a version field";
      setImportResult({ success: false, error: message });
      toast.error(message);
      return;
    }
    if (!parsed.version) {
      const message = "Invalid format: missing version";
      setImportResult({ success: false, error: message });
      toast.error(message);
      return;
    }
    importMutation.mutate(parsed);
  };

  const handleExport = async () => {
    try {
      const data = await api.post<any>("/export", { collections: exportCollections });

      if (exportFormat === "csv") {
        // One CSV file per selected collection; empty collections are skipped.
        let exported = 0;
        for (const collection of exportCollections) {
          const rows = Array.isArray(data[collection]) ? data[collection] : [];
          if (rows.length === 0) continue;
          const csv = rowsToCSV(rows);
          downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "project-e-export-" + collection + ".csv");
          exported++;
        }
        if (exported === 0) {
          toast.error("No data to export for the selected collections");
        } else {
          toast.success("Exported " + exported + " CSV file" + (exported === 1 ? "" : "s"));
        }
        return;
      }

      // JSON export — unchanged.
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "project-e-export.json");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      console.error("Export failed", e);
      toast.error(message);
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
        <Button className="mt-2" onClick={handleImport} disabled={!importData.trim() || importMutation.isPending}>
          <Upload className="h-4 w-4 mr-2" />Import
        </Button>
        {importResult && (
          <div className={cn("mt-3 p-3 rounded-lg text-sm", importResult.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>
            {importResult.success
              ? "Imported " + importResult.imported + " items"
              : importResult.error
                ? "Import failed: " + importResult.error
                : "Imported " + (importResult.imported ?? 0) + " items, " + (importResult.failed ?? 0) + " failed"}
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
    <div className="flex flex-col md:flex-row gap-2 md:gap-6 h-auto md:h-[calc(100vh-5rem)]">
      {/* Tab bar - horizontal scrollable on mobile, vertical sidebar on md+ */}
      <div className="flex md:flex-col gap-1 md:gap-0 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:w-56 md:shrink-0 md:space-y-1 shrink-0">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap shrink-0",
                "md:w-full",
                activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <Separator className="md:hidden" />
      <Separator orientation="vertical" className="hidden md:block" />
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
