import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { install, uninstall } from "@github/hotkey";
import { shortcuts, type ShortcutDefinition } from "./registry";
import { useCommandStore } from "@/lib/commands";
import type { CommandContext } from "@/lib/commands/registry";

const REMAPS_KEY = "project-e-shortcut-remaps";

function loadRemaps(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(REMAPS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRemaps(remaps: Record<string, string>) {
  localStorage.setItem(REMAPS_KEY, JSON.stringify(remaps));
}

function getEffectiveKeys(shortcut: ShortcutDefinition, remaps: Record<string, string>): string {
  return remaps[shortcut.id] || shortcut.defaultKeys;
}

function findCollision(
  shortcutId: string,
  newKeys: string,
  remaps: Record<string, string>,
): ShortcutDefinition | null {
  for (const s of shortcuts) {
    if (s.id === shortcutId) continue;
    const effective = getEffectiveKeys(s, remaps);
    if (effective === newKeys) return s;
  }
  return null;
}

/**
 * Hook that installs all keyboard shortcuts from the registry.
 * Uses @github/hotkey for multi-key sequences and a global keydown
 * handler for modifier combos (Cmd/Ctrl + key).
 *
 * Must be called inside a React component (uses hooks).
 */
export function useShortcutManager(enabled = true) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const remapsRef = useRef<Record<string, string>>(loadRemaps());

  const runCommand = useCommandStore((s) => s.run);

  const buildContext = useCallback(
    (): CommandContext => ({
      navigate: (opts) => navigate(opts),
    }),
    [navigate],
  );

  useEffect(() => {
    if (!enabled) return;

    const ctx = buildContext();

    // Hidden container for @github/hotkey synthetic elements
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.display = "none";
    document.body.appendChild(container);
    containerRef.current = container;

    const hotkeyElements: HTMLElement[] = [];

    // Install @github/hotkey for sequences and single keys
    for (const shortcut of shortcuts) {
      const keys = getEffectiveKeys(shortcut, remapsRef.current);

      // Skip modifier combos — they're handled by keydown below
      if (
        keys.includes("Meta+") ||
        keys.includes("Control+") ||
        keys.includes("Alt+") ||
        keys.includes("Shift+")
      ) {
        continue;
      }

      const el = document.createElement("span");
      el.setAttribute("data-hotkey", keys);
      el.addEventListener("hotkey-fire", (e: Event) => {
        e.preventDefault();
        runCommand(shortcut.commandId, ctx);
      });
      container.appendChild(el);
      install(el, keys);
      hotkeyElements.push(el);
    }

    // Global keydown handler for modifier combos (Cmd/Ctrl+K, Cmd/Ctrl+N)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never override native behavior inside controls or modal UI
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest(
          '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]',
        )
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      for (const shortcut of shortcuts) {
        const keys = getEffectiveKeys(shortcut, remapsRef.current);
        if (!keys.includes("Meta+") && !keys.includes("Control+")) continue;

        // Parse the key from the shortcut definition
        // e.g., "Meta+k" → "k", "Ctrl+n" → "n"
        const parts = keys.split("+");
        const shortcutKey = parts[parts.length - 1].toLowerCase();

        if (e.key.toLowerCase() === shortcutKey) {
          e.preventDefault();
          runCommand(shortcut.commandId, ctx);
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const el of hotkeyElements) {
        uninstall(el);
      }
      document.body.removeChild(container);
      containerRef.current = null;
    };
  }, [enabled, buildContext, runCommand]);

  /** Save a custom key binding for a shortcut. Returns false if there's a collision. */
  const saveRemap = useCallback(
    (shortcutId: string, newKeys: string): boolean => {
      const remaps = { ...remapsRef.current };

      // Check for collision with another shortcut
      const collision = findCollision(shortcutId, newKeys, remaps);
      if (collision) {
        return false;
      }

      remaps[shortcutId] = newKeys;
      remapsRef.current = remaps;
      saveRemaps(remaps);

      // Trigger re-render by reloading the page (shortcuts need reinstall)
      window.location.reload();
      return true;
    },
    [],
  );

  /** Reset a shortcut to its default keys. */
  const resetRemap = useCallback((shortcutId: string) => {
    const remaps = { ...remapsRef.current };
    delete remaps[shortcutId];
    remapsRef.current = remaps;
    saveRemaps(remaps);

    // Trigger re-render by reloading the page
    window.location.reload();
  }, []);

  /** Get the effective keys for a shortcut (with remaps applied). */
  const getKeys = useCallback(
    (shortcut: ShortcutDefinition): string => {
      return getEffectiveKeys(shortcut, remapsRef.current);
    },
    [],
  );

  return { saveRemap, resetRemap, getKeys };
}
