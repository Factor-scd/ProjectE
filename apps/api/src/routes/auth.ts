import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { db, users } from "@project-e/db";
import { count, eq } from "drizzle-orm";
import { createToken, requireAuth, createErrorResponse, AuthError } from "../middleware/auth";

export const authRoutes = new Hono();

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

// POST /api/auth/passkey/register — Register a passkey
authRoutes.post("/passkey/register", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
    }

    const body = await c.req.json();
    const { credentialId, publicKey, counter } = body;

    if (!credentialId || !publicKey) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "credentialId and publicKey are required" } }, 400);
    }

    await db
      .update(users)
      .set({
        passkeyCredentialId: credentialId,
        passkeyPublicKey: publicKey,
        passkeyCounter: counter ?? 0,
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error) {
    console.error("[passkey/register] error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to register passkey" } }, 500);
  }
});

// POST /api/auth/passkey/authenticate — Verify passkey login
authRoutes.post("/passkey/authenticate", async (c) => {
  try {
    const body = await c.req.json();
    const { credentialId, signature, authenticatorData, clientDataJSON } = body;

    if (!credentialId || !signature) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "credentialId and signature are required" } }, 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passkeyCredentialId, credentialId))
      .limit(1);

    if (!user) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Passkey not found" } }, 401);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[passkey/authenticate] error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to verify passkey" } }, 500);
  }
});
