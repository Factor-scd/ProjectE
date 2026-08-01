import { Hono } from "hono";

export const mcpRoutes = new Hono();

// GET /mcp — placeholder returning JSON-RPC methods list
mcpRoutes.get("/", (c) => {
  return c.json({
    jsonrpc: "2.0",
    methods: [
      { name: "ping", description: "Health check" },
      { name: "list_tools", description: "List available tools" },
    ],
  });
});
