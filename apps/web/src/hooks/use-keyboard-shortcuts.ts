import { useKeyboardShortcutsStore } from "@/lib/stores/use-keyboard-shortcuts-store";
import { useShortcutManager } from "@/lib/shortcuts/use-shortcut-manager";

/**
 * Thin wrapper that installs all keyboard shortcuts from the central registry
 * via {@link useShortcutManager}. The shortcut manager always installs hotkeys
 * (unconditionally, to satisfy React's rules-of-hooks), but the underlying
 * handler checks the `enabled` flag from the store before dispatching.
 */
export function useKeyboardShortcuts() {
  const { enabled } = useKeyboardShortcutsStore();

  // Always call the hook (rules of hooks). The manager's effect installs
  // hotkeys unconditionally — the `enabled` guard lives in the dispatch
  // path so toggling the flag disables shortcuts without reinstalling.
  useShortcutManager(enabled);
}
