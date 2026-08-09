'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutGrid, Plus, Trash2, GripVertical, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CanvasCard {
  id: string;
  canvas_id: string;
  type: 'note' | 'task' | 'image' | 'entity';
  entity_id?: string;
  title?: string;
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  z_index: number;
  created: string;
  updated: string;
}

interface CanvasConnection {
  id: string;
  source_card_id: string;
  target_card_id: string;
  label?: string;
  style: 'solid' | 'dashed' | 'dotted';
}

interface Canvas {
  id: string;
  name: string;
  description?: string;
  mode: 'freeform' | 'graph';
  domain: string;
  tags: string[];
  cards: CanvasCard[];
  connections: CanvasConnection[];
  viewport?: { x: number; y: number; zoom: number };
  background?: string;
  created: string;
  updated: string;
}

function CanvasBoard({ canvas, onBack }: { canvas: Canvas; onBack: () => void }) {
  const [cards, setCards] = useState<CanvasCard[]>(canvas.cards || []);
  const [connections] = useState<CanvasConnection[]>(canvas.connections || []);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(canvas.viewport || { x: 0, y: 0, zoom: 1 });
  const [editingCard, setEditingCard] = useState<CanvasCard | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, cardId: string) => {
      e.preventDefault();
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      setDragging(cardId);
      setDragOffset({
        x: e.clientX - card.x * viewport.zoom,
        y: e.clientY - card.y * viewport.zoom,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cards, viewport.zoom]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newX = (e.clientX - dragOffset.x) / viewport.zoom;
      const newY = (e.clientY - dragOffset.y) / viewport.zoom;
      setCards((prev) =>
        prev.map((c) => (c.id === dragging ? { ...c, x: Math.max(0, newX), y: Math.max(0, newY) } : c))
      );
    },
    [dragging, dragOffset, viewport.zoom]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  async function saveCardPosition(card: CanvasCard) {
    try {
      await fetch(`/api/canvases/${canvas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: cards.map((c) =>
            c.id === card.id
              ? { ...c, x: card.x, y: card.y }
              : c
          ),
        }),
      });
    } catch (err) {
      console.error('Failed to save card position:', err);
    }
  }

  async function addCard() {
    const newCard: CanvasCard = {
      id: crypto.randomUUID(),
      canvas_id: canvas.id,
      type: 'note',
      title: 'New note',
      content: '',
      x: 50 + Math.random() * 200,
      y: 50 + Math.random() * 200,
      width: 200,
      height: 150,
      rotation: 0,
      z_index: cards.length,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    const updatedCards = [...cards, newCard];
    setCards(updatedCards);
    try {
      await fetch(`/api/canvases/${canvas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: updatedCards }),
      });
      toast.success('Card added');
    } catch (err) {
      console.error('Failed to add card:', err);
      toast.error('Failed to add card');
    }
  }

  async function deleteCard(cardId: string) {
    const updatedCards = cards.filter((c) => c.id !== cardId);
    setCards(updatedCards);
    try {
      await fetch(`/api/canvases/${canvas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: updatedCards }),
      });
      toast.success('Card removed');
    } catch (err) {
      console.error('Failed to delete card:', err);
      toast.error('Failed to delete card');
    }
  }

  async function saveCardEdit() {
    if (!editingCard) return;
    const updatedCards = cards.map((c) =>
      c.id === editingCard.id
        ? { ...c, title: editTitle, content: editContent }
        : c
    );
    setCards(updatedCards);
    setEditingCard(null);
    try {
      await fetch(`/api/canvases/${canvas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: updatedCards }),
      });
    } catch (err) {
      console.error('Failed to save card:', err);
    }
  }

  function openEdit(card: CanvasCard) {
    setEditingCard(card);
    setEditTitle(card.title || '');
    setEditContent(card.content || '');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <X className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">{canvas.name}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.25, v.zoom - 0.1) }))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(3, v.zoom + 0.1) }))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            aria-label="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="default" size="sm" onClick={addCard}>
            <Plus className="mr-1 h-4 w-4" />
            Add card
          </Button>
        </div>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative flex-1 overflow-hidden bg-muted/30"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: dragging ? 'grabbing' : 'default' }}
      >
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Connections */}
          <svg className="pointer-events-none absolute inset-0" style={{ width: 4000, height: 4000 }}>
            {connections.map((conn) => {
              const source = cards.find((c) => c.id === conn.source_card_id);
              const target = cards.find((c) => c.id === conn.target_card_id);
              if (!source || !target) return null;
              return (
                <line
                  key={conn.id}
                  x1={source.x + source.width / 2}
                  y1={source.y + source.height / 2}
                  x2={target.x + target.width / 2}
                  y2={target.y + target.height / 2}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray={conn.style === 'dashed' ? '6,3' : conn.style === 'dotted' ? '2,2' : undefined}
                  opacity={0.4}
                />
              );
            })}
          </svg>

          {/* Cards */}
          {cards.map((card) => (
            <div
              key={card.id}
              className="absolute rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md"
              style={{
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
                zIndex: dragging === card.id ? 999 : card.z_index,
                transform: `rotate(${card.rotation}deg)`,
              }}
            >
              {/* Drag handle */}
              <div
                className="flex cursor-grab items-center gap-1 border-b bg-muted/30 px-2 py-1 rounded-t-lg"
                onPointerDown={(e) => handlePointerDown(e, card.id)}
                style={{ touchAction: 'none' }}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="flex-1 truncate text-xs font-medium">
                  {card.title || 'Untitled'}
                </span>
                <button
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(card)}
                  aria-label="Edit card"
                >
                  <span className="text-xs">Edit</span>
                </button>
                <button
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteCard(card.id)}
                  aria-label="Delete card"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {/* Content */}
              <div className="overflow-auto p-2 text-xs text-muted-foreground" style={{ height: 'calc(100% - 28px)' }}>
                {card.content || 'No content'}
              </div>
            </div>
          ))}

          {cards.length === 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No cards yet</p>
              <Button className="mt-2" size="sm" onClick={addCard}>
                <Plus className="mr-1 h-4 w-4" />
                Add your first card
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Card title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Card content"
                rows={4}
              />
            </div>
            <Button onClick={saveCardEdit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CanvasPage() {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCanvas, setActiveCanvas] = useState<Canvas | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchCanvases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/canvases?sort=-updated');
      if (!res.ok) throw new Error('Unable to load canvases.');
      const data = await res.json();
      setCanvases(data.items || []);
    } catch (err) {
      console.error('Failed to fetch canvases:', err);
      setError('Unable to load canvases. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCanvases();
  }, [fetchCanvases]);

  async function createCanvas() {
    setCreating(true);
    try {
      const res = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New canvas',
          mode: 'freeform',
        }),
      });
      if (!res.ok) throw new Error('Unable to create canvas.');
      const canvas = await res.json();
      setCanvases((prev) => [canvas, ...prev]);
      setActiveCanvas(canvas);
      toast.success('Canvas created');
    } catch (err) {
      console.error('Failed to create canvas:', err);
      toast.error('Unable to create canvas');
    } finally {
      setCreating(false);
    }
  }

  async function deleteCanvas(id: string) {
    try {
      await fetch(`/api/canvases/${id}`, { method: 'DELETE' });
      setCanvases((prev) => prev.filter((c) => c.id !== id));
      if (activeCanvas?.id === id) setActiveCanvas(null);
      toast.success('Canvas deleted');
    } catch (err) {
      console.error('Failed to delete canvas:', err);
      toast.error('Unable to delete canvas');
    }
  }

  async function openCanvas(canvas: Canvas) {
    try {
      const res = await fetch(`/api/canvases/${canvas.id}`);
      if (!res.ok) throw new Error('Unable to load canvas.');
      const full = await res.json();
      setActiveCanvas(full);
    } catch (err) {
      console.error('Failed to open canvas:', err);
      toast.error('Unable to open canvas');
    }
  }

  if (activeCanvas) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <CanvasBoard canvas={activeCanvas} onBack={() => setActiveCanvas(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canvas</h1>
          <p className="mt-1 text-muted-foreground">
            Freeform boards for visual thinking.
          </p>
        </div>
        <Button onClick={createCanvas} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" />
          {creating ? 'Creating...' : 'New canvas'}
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading canvases...</p>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-red-600" role="alert">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchCanvases}>
            Retry
          </Button>
        </div>
      ) : canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <LayoutGrid className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No canvases yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a canvas to start visual brainstorming.
          </p>
          <Button className="mt-4" onClick={createCanvas} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first canvas
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canvases.map((canvas) => (
            <Card
              key={canvas.id}
              className="group cursor-pointer p-4 transition-colors hover:bg-accent/50"
              onClick={() => openCanvas(canvas)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-medium">{canvas.name}</h3>
                  {canvas.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {canvas.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {(canvas.cards || []).length} cards
                  </p>
                </div>
                <button
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCanvas(canvas.id);
                  }}
                  aria-label={`Delete ${canvas.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
