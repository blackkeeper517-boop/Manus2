import { createHash } from "node:crypto";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  vaultFiles,
  vaultProjects,
  vaultRevisions,
  auditLogs,
  chatMessages,
  productAliases,
  ProductAlias,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

function fileChecksum(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function checksumForFile(content: string) {
  return fileChecksum(content);
}

export async function listVaultProjects(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vaultProjects).where(eq(vaultProjects.ownerId, ownerId)).orderBy(desc(vaultProjects.updatedAt));
}

export async function getVaultProject(ownerId: number, projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(vaultProjects)
    .where(and(eq(vaultProjects.id, projectId), eq(vaultProjects.ownerId, ownerId)))
    .limit(1);
  return result[0];
}

export async function createVaultProject(ownerId: number, input: { name: string; description?: string; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const baseSlug = input.name.toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/gi, "-").replace(/^-|-$/g, "") || "project";
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const result = await db.insert(vaultProjects).values({
    ownerId,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    category: input.category?.trim() || "project",
  });
  return getVaultProject(ownerId, Number(result[0].insertId));
}

export async function listVaultFiles(ownerId: number, projectId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(vaultFiles.ownerId, ownerId), eq(vaultFiles.projectId, projectId)];
  const query = search?.trim();
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(vaultFiles.title, pattern), like(vaultFiles.path, pattern), like(vaultFiles.language, pattern))!);
  }
  return db.select().from(vaultFiles).where(and(...conditions)).orderBy(desc(vaultFiles.isFavorite), desc(vaultFiles.updatedAt));
}

export async function getVaultFile(ownerId: number, fileId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(vaultFiles)
    .where(and(eq(vaultFiles.id, fileId), eq(vaultFiles.ownerId, ownerId)))
    .limit(1);
  return result[0];
}

export async function createVaultFile(ownerId: number, input: {
  projectId: number;
  path: string;
  title: string;
  language: string;
  kind: "code" | "sql" | "workflow" | "document" | "config" | "other";
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const content = input.content ?? "";
  const result = await db.insert(vaultFiles).values({
    ownerId,
    projectId: input.projectId,
    path: input.path.trim(),
    title: input.title.trim(),
    language: input.language.trim() || "text",
    kind: input.kind,
    content,
    checksum: fileChecksum(content),
    sizeBytes: Buffer.byteLength(content, "utf8"),
  });
  await db.update(vaultProjects).set({ updatedAt: new Date() }).where(and(eq(vaultProjects.id, input.projectId), eq(vaultProjects.ownerId, ownerId)));
  return getVaultFile(ownerId, Number(result[0].insertId));
}

export async function updateVaultFile(ownerId: number, fileId: number, input: {
  projectId: number;
  path: string;
  title: string;
  language: string;
  kind: "code" | "sql" | "workflow" | "document" | "config" | "other";
  content: string;
  isFavorite?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = await getVaultFile(ownerId, fileId);
  if (!current || current.projectId !== input.projectId) return undefined;
  const content = input.content ?? "";

  await db.transaction(async tx => {
    if (current.content !== content) {
      await tx.insert(vaultRevisions).values({
        fileId,
        projectId: current.projectId,
        ownerId,
        content: current.content,
        checksum: current.checksum,
        sizeBytes: current.sizeBytes,
      });
    }
    await tx.update(vaultFiles).set({
      path: input.path.trim(),
      title: input.title.trim(),
      language: input.language.trim() || "text",
      kind: input.kind,
      content,
      checksum: fileChecksum(content),
      sizeBytes: Buffer.byteLength(content, "utf8"),
      isFavorite: input.isFavorite ?? current.isFavorite,
      updatedAt: new Date(),
    }).where(eq(vaultFiles.id, fileId));
    await tx.update(vaultProjects).set({ updatedAt: new Date() }).where(and(eq(vaultProjects.id, current.projectId), eq(vaultProjects.ownerId, ownerId)));
  });
  return getVaultFile(ownerId, fileId);
}

export async function getVaultStats(ownerId: number) {
  const db = await getDb();
  if (!db) return { projects: 0, files: 0, revisions: 0 };
  const [projectRows, fileRows, revisionRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vaultProjects).where(eq(vaultProjects.ownerId, ownerId)),
    db.select({ count: sql<number>`count(*)` }).from(vaultFiles).where(eq(vaultFiles.ownerId, ownerId)),
    db.select({ count: sql<number>`count(*)` }).from(vaultRevisions).where(eq(vaultRevisions.ownerId, ownerId)),
  ]);
  return {
    projects: Number(projectRows[0]?.count ?? 0),
    files: Number(fileRows[0]?.count ?? 0),
    revisions: Number(revisionRows[0]?.count ?? 0),
  };
}

export async function saveChatMessage(input: {
  providerMessageId?: string;
  pageId: string;
  pageName?: string;
  threadId: string;
  senderId: string;
  senderType: "customer" | "admin" | "page" | "system";
  direction: "inbound" | "outbound";
  text?: string;
  attachments?: unknown;
  adminUserId?: number;
  occurredAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(chatMessages).values({
    providerMessageId: input.providerMessageId ?? null,
    pageId: input.pageId,
    pageName: input.pageName ?? null,
    threadId: input.threadId,
    senderId: input.senderId,
    senderType: input.senderType,
    direction: input.direction,
    text: input.text ?? null,
    attachmentsJson: input.attachments ? JSON.stringify(input.attachments) : null,
    adminUserId: input.adminUserId ?? null,
    occurredAt: input.occurredAt ?? new Date(),
  }).onDuplicateKeyUpdate({ set: { providerMessageId: input.providerMessageId ?? null } });
}

export async function listChatMessages(pageId: string, threadId: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(and(eq(chatMessages.pageId, pageId), eq(chatMessages.threadId, threadId))).orderBy(desc(chatMessages.occurredAt)).limit(limit);
}

export async function listStoredChatMessages(limit = 2000) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).orderBy(desc(chatMessages.occurredAt)).limit(limit);
}

export async function createAuditLog(input: {
  actorUserId?: number;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  pageId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorName: input.actorName ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    pageId: input.pageId ?? null,
    threadId: input.threadId ?? null,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export async function listAuditLogs(limit = 100, action?: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).where(action ? eq(auditLogs.action, action) : undefined).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

const aliasCache = new Map<number, { expiresAt: number; value: ProductAlias[] }>();

export async function listProductAliases(ownerId: number): Promise<ProductAlias[]> {
  const db = await getDb();
  if (!db) return [];
  const cached = aliasCache.get(ownerId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await db.select().from(productAliases).where(eq(productAliases.ownerId, ownerId)).orderBy(desc(productAliases.updatedAt));
  aliasCache.set(ownerId, { expiresAt: Date.now() + 60_000, value });
  return value;
}

export async function createProductAlias(ownerId: number, input: { alias: string; canonicalSku: string; canonicalLabel: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const cleanAlias = input.alias.trim();
  const existingRows = await db.select().from(productAliases).where(eq(productAliases.ownerId, ownerId));
  const existing = existingRows.find(row => row.alias.trim().toLocaleLowerCase() === cleanAlias.toLocaleLowerCase());
  if (existing) {
    await db.update(productAliases).set({ alias: cleanAlias, canonicalSku: input.canonicalSku, canonicalLabel: input.canonicalLabel, isActive: true, updatedAt: new Date() }).where(and(eq(productAliases.id, existing.id), eq(productAliases.ownerId, ownerId)));
  } else {
    await db.insert(productAliases).values({ ownerId, alias: cleanAlias, canonicalSku: input.canonicalSku, canonicalLabel: input.canonicalLabel });
  }
  aliasCache.delete(ownerId);
  return listProductAliases(ownerId);
}

export async function updateProductAlias(ownerId: number, id: number, input: { alias: string; canonicalSku: string; canonicalLabel: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(productAliases).set(input).where(and(eq(productAliases.id, id), eq(productAliases.ownerId, ownerId)));
  aliasCache.delete(ownerId);
  return listProductAliases(ownerId);
}
