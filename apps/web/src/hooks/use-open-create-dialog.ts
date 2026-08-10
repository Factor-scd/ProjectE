import { useEffect } from "react";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";

/**
 * Opens a page's local create dialog when the global "new entity" shortcut or
 * command palette requests it. Pages must call this once with their entity type
 * and a callback that flips their own create-open state.
 *
 * The store is re-read inside the effect (rather than trusting the captured
 * value) so React StrictMode's double-invoked effects can't fire onOpen twice.
 */
export function useOpenCreateDialog(type: "task" | "habit" | "project" | "note" | "event", onOpen: () => void) {
  const open = useCreateDialogStore((s) => s.open);
  const storeType = useCreateDialogStore((s) => s.type);

  useEffect(() => {
    const state = useCreateDialogStore.getState();
    if (state.open && state.type === type) {
      useCreateDialogStore.getState().closeCreate();
      onOpen();
    }
  }, [open, storeType, type, onOpen]);
}
