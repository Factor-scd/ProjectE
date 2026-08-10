import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { createHash } from "node:crypto";
import { db, users, apiKeys, domains } from "@project-e/db";
import { and, asc, eq } from "drizzle-orm";

const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me");
const COOKIE_NAME = "session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | null;
  }
}

export async function createToken(user: { id: string; email: string; name: string }): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(AUTH_SECRET);
}

export async function verifyToken(token: string): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET);
    if (!payload.sub || !payload.email) return null;
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: (payload.name as string) || (payload.email as string),
    };
  } catch {
    return null;
  }
}

async function authenticateApiKey(apiKey: string): Promise<{ id: string; email: string; name: string } | null> {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const [keyRecord] = await db
    .select({
      userId: apiKeys.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);

  if (!keyRecord) return null;

  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.keyHash, keyHash));

  return {
    id: keyRecord.userId,
    email: keyRecord.userEmail,
    name: keyRecord.userName || keyRecord.userEmail,
  };
}

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const cookieHeader = c.req.header("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(s => s.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, v.join("=")])
  );
  const token = cookies[COOKIE_NAME] || c.req.header("Authorization")?.replace("Bearer ", "");
  if (token) {
    // Try JWT first
    const user = await verifyToken(token);
    if (user) {
      c.set("user", user);
      return next();
    }
    // Fall back to API key auth
    const apiUser = await authenticateApiKey(token);
    if (apiUser) {
      c.set("user", apiUser);
      return next();
    }
  }
  c.set("user", null);
  return next();
});

export async function requireAuth(c: Context): Promise<AuthUser> {
  const user = c.get("user");
  if (!user) {
    throw new AuthError("Not authenticated", 401, "UNAUTHORIZED");
  }
  return user;
}

/**
 * Require access to a workspace (domain). Verifies the workspace exists and,
 * when a user is present on the context, that the user owns it.
 *
 * Ownership fallback: domain rows created before the ownership model was
 * introduced may have a NULL ownerId. For those rows we fall back to the
 * existence check only, so legacy data isn't locked out.
 *
 * @returns the domain row so callers can reuse it (id, name, slug, ownerId, …)
 * @throws AuthError 403 FORBIDDEN when workspaceId is missing/empty or not owned
 * @throws AuthError 404 NOT_FOUND when no such workspace exists
 */
export async function requireWorkspaceAccess(c: Context, workspaceId: string): Promise<typeof domains.$inferSelect> {
  if (!workspaceId || workspaceId.trim() === "") {
    throw new AuthError("Workspace ID is required", 403, "FORBIDDEN");
  }

  const [domain] = await db
    .select()
    .from(domains)
    .where(eq(domains.id, workspaceId))
    .limit(1);

  if (!domain) {
    throw new AuthError("Workspace not found", 404, "NOT_FOUND");
  }

  const user = c.get("user");
  // Single-user/personal app: ownership is enforced when a user is known.
  // Rows with NULL ownerId (legacy) are allowed through the existence check above.
  if (user && domain.ownerId !== null && domain.ownerId !== user.id) {
    throw new AuthError("You do not have access to this workspace", 403, "FORBIDDEN");
  }

  return domain;
}

export async function resolveActiveDomain(user: { id: string; email: string; name?: string | null }): Promise<{ id: string; name: string; created: boolean }> {
  const [existing] = await db
    .select({ id: domains.id, name: domains.name })
    .from(domains)
    .where(eq(domains.ownerId, user.id))
    .orderBy(asc(domains.sortOrder), asc(domains.createdAt))
    .limit(1);
  if (existing) return { ...existing, created: false };

  const slug = "personal-" + user.id.slice(0, 8);
  const [created] = await db.insert(domains).values({
    ownerId: user.id,
    name: "Personal",
    slug: slug,
    sortOrder: 0,
  }).returning({ id: domains.id, name: domains.name });
  return { ...created, created: true };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
    public code: string = "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when a value looks like a UUID. Route params that are entity ids should
 * be validated with this before hitting the DB so a malformed id returns 404
 * instead of a Postgres "invalid input syntax for type uuid" 500.
 */
export function isUuid(value: string | undefined | null): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function createErrorResponse(code: string, message: string, status: number = 400, details?: unknown) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
