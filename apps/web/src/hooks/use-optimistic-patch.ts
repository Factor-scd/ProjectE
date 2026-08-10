import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface PatchVariables {
  id: string;
  data: Record<string, unknown>;
}

interface UseOptimisticPatchOptions<T extends { id: string }> {
  /** Detail query key, e.g. ["task", id]. */
  entityKey: string[];
  /** List query keys to prefix-invalidate after settle, e.g. [["tasks"]]. */
  listKeys?: string[][];
  /** Builds the PATCH url from the entity id, e.g. (id) => `/tasks/${id}`. */
  patchUrl: (id: string) => string;
  /** Merges the partial update into the cached entity for the optimistic UI. */
  applyPatch: (current: T, data: Record<string, unknown>) => T;
}

/**
 * Optimistic PATCH with rollback, shared by all entity detail pages.
 *
 * Returns a `patch({ id, data })` callable: the mutation updates the detail
 * query cache immediately via `applyPatch`, restores the previous snapshot on
 * error (with an error toast), and prefix-invalidates the entity key plus all
 * list keys once the request settles.
 */
export function useOptimisticPatch<T extends { id: string }>(
  opts: UseOptimisticPatchOptions<T>
) {
  const queryClient = useQueryClient();
  const { entityKey, listKeys = [], patchUrl, applyPatch } = opts;

  const mutation = useMutation({
    mutationFn: ({ id, data }: PatchVariables) =>
      api.patch<unknown>(patchUrl(id), data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: entityKey });
      const previous = queryClient.getQueryData<T>(entityKey);
      queryClient.setQueryData<T>(entityKey, (old) =>
        old ? applyPatch(old, data) : old
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<T>(entityKey, context.previous);
      }
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message || "Failed to save");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: entityKey });
      for (const key of listKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  return {
    ...mutation,
    patch: mutation.mutate,
  };
}
