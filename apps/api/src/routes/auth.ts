import { Hono } from "hono";

export const authRoutes = new Hono();

// POST /api/auth/credentials — stub JWT placeholder
authRoutes.post("/credentials", async (c) => {
  const { email, password } = await c.req.json();
  // Stub: accept any credentials for now
  if (!email || !password) {
    return c.json({ message: "Email and password required" }, 400);
  }
  // Return a stub JWT (real auth in T2)
  return c.json({
    token: "stub-jwt-token",
    user: { email, name: email.split("@")[0] },
  });
});

// GET /api/auth/session — placeholder
authRoutes.get("/session", (c) => {
  return c.json({ authenticated: false, user: null });
});
