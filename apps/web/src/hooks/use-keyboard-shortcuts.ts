import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKeyboardShortcutsStore } from "@/lib/stores/use-keyboard-shortcuts-store";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { enabled } = useKeyboardShortcutsStore();

  useEffect(() => {
    if (!enabled) return;

    let pendingKey = "";
    let pendingTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never override native behavior inside controls or modal UI
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "BUTTON" ||
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

      // ? — show shortcuts help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-shortcuts-help"));
        return;
      }

      // / — focus search (when not in an input)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-command-palette"));
        return;
      }

      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle two-key combos (G then letter)
      if (pendingKey) {
        clearTimeout(pendingTimeout);
        pendingKey = "";

        const navMap: Record<string, string> = {
          d: "/",
          t: "/tasks",
          h: "/habits",
          p: "/projects",
          n: "/notes",
          c: "/calendar",
          g: "/graph",
          s: "/settings",
        };

        if (navMap[key]) {
          e.preventDefault();
          navigate({ to: navMap[key] });
        }
        return;
      }

      // Single key shortcuts
      switch (key) {
        case "g":
          pendingKey = "g";
          pendingTimeout = setTimeout(() => {
            pendingKey = "";
          }, 1000);
          e.preventDefault();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, enabled]);
}
