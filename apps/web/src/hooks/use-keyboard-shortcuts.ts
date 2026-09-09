import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKeyboardShortcutsStore } from "@/lib/stores/use-keyboard-shortcuts-store";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";
import { install, uninstall } from "@github/hotkey";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { enabled } = useKeyboardShortcutsStore();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create a hidden container for @github/hotkey installs
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.display = "none";
    document.body.appendChild(container);
    containerRef.current = container;

    // Helper: install a hotkey on a synthetic element
    const addHotkey = (hotkey: string, handler: () => void) => {
      const el = document.createElement("span");
      el.setAttribute("data-hotkey", hotkey);
      el.addEventListener("hotkey-fire", (e: Event) => {
        e.preventDefault();
        handler();
      });
      container.appendChild(el);
      install(el, hotkey);
      return el;
    };

    // g+letter navigation sequences
    const navMap: Record<string, string> = {
      "g i": "/inbox",
      "g d": "/",
      "g t": "/tasks",
      "g h": "/habits",
      "g p": "/projects",
      "g n": "/notes",
      "g c": "/calendar",
      "g g": "/graph",
      "g r": "/reports",
      "g s": "/settings",
    };

    for (const [seq, path] of Object.entries(navMap)) {
      addHotkey(seq, () => {
        navigate({ to: path });
      });
    }

    // n+letter new-entity sequences — navigate AND open the create dialog on
    // the target page (the page's effect consumes the store request).
    const newMap: Record<string, { path: string; type: "task" | "habit" | "project" | "note" }> = {
      "n t": { path: "/tasks", type: "task" },
      "n h": { path: "/habits", type: "habit" },
      "n p": { path: "/projects", type: "project" },
      "n n": { path: "/notes", type: "note" },
    };

    for (const [seq, { path, type }] of Object.entries(newMap)) {
      addHotkey(seq, () => {
        useCreateDialogStore.getState().openCreate(type);
        navigate({ to: path });
      });
    }

    // Global keydown handler for single-key shortcuts and Cmd+K
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never override native behavior inside controls or modal UI
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')
      ) {
        return;
      }

      // Cmd+K / Ctrl+K — open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-command-palette"));
        return;
      }

      // Cmd+N / Ctrl+N — new task
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useCreateDialogStore.getState().openCreate("task");
        navigate({ to: "/tasks" });
        return;
      }

      // Single-key shortcuts (no modifiers)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("open-shortcuts-help"));
          break;
        case "/":
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("open-command-palette"));
          break;
        case "c":
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("open-command-palette"));
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const child of container.children) {
        uninstall(child as HTMLElement);
      }
      document.body.removeChild(container);
      containerRef.current = null;
    };
  }, [navigate, enabled]);
}
