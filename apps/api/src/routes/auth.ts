import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { db, users } from "@project-e/db";
import { count, eq } from "drizzle-orm";
import { createToken } from "../middleware/auth";

export const authRoutes = new Hono();

// NOTE: Passkeys are intentionally NOT implemented. The legacy passkey routes were
// removed because they issued a session without verifying the WebAuthn signature
// (an authentication bypass). Do not re-add passkey endpoints without full
// WebAuthn challenge/attestation verification.

// POST /api/auth/credentials — Login with email + password
authRoutes.post("/credentials", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Email and password required" } }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    if (!user) {
      // First-user auto-creation (same as legacy auth-config.ts)
      const [{ total }] = await db.select({ total: count() }).from(users);
      const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (total === 0 && normalizedEmail === initialEmail && password === initialPassword) {
        [user] = await db.insert(users).values({
          email: normalizedEmail,
          name: process.env.INITIAL_ADMIN_NAME || normalizedEmail,
          passwordHash: await bcrypt.hash(password, 12),
        }).returning();
      }
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } }, 401);
    }

    const token = await createToken({ id: user.id, email: user.email, name: user.name });
    setCookie(c, "session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    console.error("[auth/credentials] error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Login failed" } }, 500);
  }
});

// GET /api/auth/session — Return current session or null
authRoutes.get("/session", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ authenticated: false, user: null });
    }
    return c.json({ authenticated: true, user });
  } catch {
    return c.json({ authenticated: false, user: null });
  }
});

// POST /api/auth/logout — Clear the session cookie
authRoutes.post("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ success: true });
});

// GET /api/auth/me — Return current user profile
authRoutes.get("/me", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
    }
    return c.json({ user });
  } catch {
    return c.json({ error: { code: "AUTH_ERROR", message: "Invalid or expired token" } }, 401);
  }
});
