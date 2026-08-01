import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { db, users } from "@project-e/db";
import { eq } from "drizzle-orm";

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

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const cookieHeader = c.req.header("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(s => s.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, v.join("=")])
  );
  const token = cookies[COOKIE_NAME] || c.req.header("Authorization")?.replace("Bearer ", "");
  if (token) {
    const user = await verifyToken(token);
    if (user) {
      c.set("user", user);
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

export async function resolveActiveDomain(user: { id: string; email: string; name?: string | null }): Promise<{ id: string; name: string; created: boolean }> {
  const { domains } = await import("@project-e/db");
  const { asc } = await import("drizzle-orm");

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

export function createErrorResponse(code: string, message: string, status: number = 400, details?: unknown) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
