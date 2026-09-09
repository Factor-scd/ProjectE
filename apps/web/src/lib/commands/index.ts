import { create } from "zustand";
import { commands, type Command, type CommandContext } from "./registry";

interface CommandState {
  commands: Command[];
  run: (id: string, ctx: CommandContext) => void;
}

export const useCommandStore = create<CommandState>()((set) => ({
  commands,
  run: (id, ctx) => {
    const cmd = commands.find((c) => c.id === id);
    if (cmd) cmd.run(ctx);
  },
}));

export function useCommands() {
  return useCommandStore();
}
