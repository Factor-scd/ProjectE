import { Hono } from "hono";
import { db, domains as domainsTable } from "@project-e/db";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth, createErrorResponse, resolveActiveDomain, AuthError, isUuid } from "../middleware/auth";

export const domainRoutes = new Hono();

// GET /api/domains — List domains
domainRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const sortParam = url.searchParams.get("sort") || "sort_order";
    const filter = url.searchParams.get("filter") || undefined;

    const sortDir = sortParam.startsWith("-") ? "desc" : "asc";
    const sortField = sortParam.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      name: domainsTable.name,
      slug: domainsTable.slug,
      sort_order: domainsTable.sortOrder,
      created_at: domainsTable.createdAt,
      updated_at: domainsTable.updatedAt,
    };
    const orderBy = sortDir === "asc"
      ? asc(sortColumns[sortField] || domainsTable.sortOrder)
      : desc(sortColumns[sortField] || domainsTable.sortOrder);

    const conditions: any[] = [eq(domainsTable.ownerId, user.id)];
    if (filter) {
      conditions.push(
        or(
          ilike(domainsTable.name, `%${filter}%`),
          ilike(domainsTable.slug, `%${filter}%`),
        )!
      );
    }

    const offset = (page - 1) * perPage;

    const [items, countResult] = await Promise.all([
      db.select()
        .from(domainsTable)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(perPage)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(domainsTable)
        .where(and(...conditions)),
    ]);

    let totalItems = Number(countResult[0]?.count || 0);

    if (totalItems === 0) {
      const active = await resolveActiveDomain(user);
      const [newItems, newCount] = await Promise.all([
        db.select()
          .from(domainsTable)
          .where(eq(domainsTable.ownerId, user.id))
          .orderBy(orderBy)
          .limit(perPage)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(domainsTable)
          .where(eq(domainsTable.ownerId, user.id)),
      ]);
      return c.json({
        items: newItems,
        totalItems: Number(newCount[0]?.count || 0),
        totalPages: Math.ceil(Number(newCount[0]?.count || 0) / perPage),
        page,
        perPage,
      });
    }

    return c.json({
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / perPage),
      page,
      perPage,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[domains] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list domains" } }, 500);
  }
});

// POST /api/domains — Create a domain
domainRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { name, slug, color, icon, parentId } = body;

    if (!name) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Name is required" } }, 400 as any);
    }

    const domainSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "domain";

    const [domain] = await db.insert(domainsTable)
      .values({
        name,
        slug: domainSlug,
        color: color || null,
        icon: icon || null,
        parentId: parentId || null,
        ownerId: user.id,
      })
      .returning();

    return c.json(domain, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[domains] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create domain" } }, 500);
  }
});

// GET /api/domains/:id — Get a single domain
domainRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [domain] = await db
      .select()
      .from(domainsTable)
      .where(and(eq(domainsTable.id, id), eq(domainsTable.ownerId, user.id)))
      .limit(1);

    if (!domain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Domain not found" } }, 404);
    }

    return c.json(domain);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[domains] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get domain" } }, 500);
  }
});

// PATCH /api/domains/:id — Update a domain
domainRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();

    // Whitelist editable fields so a client can never overwrite ownership,
    // the slug, or sort order via an open-ended body spread.
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined && typeof body.name === "string") updateValues.name = body.name;
    if (body.color !== undefined) updateValues.color = body.color ?? null;
    if (body.icon !== undefined) updateValues.icon = body.icon ?? null;
    if (body.parentId !== undefined) updateValues.parentId = body.parentId ?? null;
    if (body.sortOrder !== undefined && typeof body.sortOrder === "number") updateValues.sortOrder = body.sortOrder;

    const [domain] = await db
      .update(domainsTable)
      .set(updateValues)
      .where(and(eq(domainsTable.id, id), eq(domainsTable.ownerId, user.id)))
      .returning();

    if (!domain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Domain not found" } }, 404);
    }

    return c.json(domain);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[domains] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update domain" } }, 500);
  }
});

// DELETE /api/domains/:id — Delete a domain
domainRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [domain] = await db
      .delete(domainsTable)
      .where(and(eq(domainsTable.id, id), eq(domainsTable.ownerId, user.id)))
      .returning({ id: domainsTable.id });

    if (!domain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Domain not found" } }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[domains] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete domain" } }, 500);
  }
});
