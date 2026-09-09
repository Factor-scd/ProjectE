import { toast } from "sonner";
import { api } from "@/lib/api";

export function showUndoToast(
  entityType: string,
  entityId: string,
  entityData: Record<string, any>,
  queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void },
  queryKey: string[],
) {
  toast.success(`${entityType} deleted`, {
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          const endpoint =
            entityType === "task"
              ? "/tasks"
              : entityType === "note"
                ? "/notes"
                : entityType === "habit"
                  ? "/habits"
                  : "/calendar/events";
          await api.post(endpoint, entityData);
          queryClient.invalidateQueries({ queryKey });
          toast.success(`${entityType} restored`);
        } catch {
          toast.error("Failed to restore");
        }
      },
    },
  });
}
