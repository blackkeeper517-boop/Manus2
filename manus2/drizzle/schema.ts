import {
  boolean,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** A logical workspace such as the Thai Order Product Parser project. */
export const vaultProjects = mysqlTable(
  "vault_projects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 80 }).default("project").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerIdx: index("vault_projects_owner_idx").on(table.ownerId),
    slugOwnerUnique: uniqueIndex("vault_projects_owner_slug_unique").on(table.ownerId, table.slug),
  }),
);

/** Source files, SQL scripts, workflow JSON, and project documentation. */
export const vaultFiles = mysqlTable(
  "vault_files",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    ownerId: int("ownerId").notNull(),
    path: varchar("path", { length: 255 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    language: varchar("language", { length: 40 }).default("text").notNull(),
    kind: mysqlEnum("kind", ["code", "sql", "workflow", "document", "config", "other"])
      .default("other")
      .notNull(),
    content: longtext("content").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    sizeBytes: int("sizeBytes").default(0).notNull(),
    isFavorite: boolean("isFavorite").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    projectIdx: index("vault_files_project_idx").on(table.projectId, table.updatedAt),
    ownerIdx: index("vault_files_owner_idx").on(table.ownerId),
    projectPathUnique: uniqueIndex("vault_files_project_path_unique").on(table.projectId, table.path),
  }),
);

/** Immutable snapshots created when a file is edited. */
export const vaultRevisions = mysqlTable(
  "vault_revisions",
  {
    id: int("id").autoincrement().primaryKey(),
    fileId: int("fileId").notNull(),
    projectId: int("projectId").notNull(),
    ownerId: int("ownerId").notNull(),
    content: longtext("content").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    sizeBytes: int("sizeBytes").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    fileIdx: index("vault_revisions_file_idx").on(table.fileId, table.createdAt),
    ownerIdx: index("vault_revisions_owner_idx").on(table.ownerId),
  }),
);

/** Raw inbound/outbound messages received from Meta or sent by an admin. */
export const chatMessages = mysqlTable(
  "chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 32 }).default("meta").notNull(),
    providerMessageId: varchar("providerMessageId", { length: 255 }),
    pageId: varchar("pageId", { length: 128 }).notNull(),
    pageName: varchar("pageName", { length: 180 }),
    threadId: varchar("threadId", { length: 255 }).notNull(),
    senderId: varchar("senderId", { length: 255 }).notNull(),
    senderType: mysqlEnum("senderType", ["customer", "admin", "page", "system"]).default("customer").notNull(),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).default("inbound").notNull(),
    text: longtext("text"),
    attachmentsJson: longtext("attachmentsJson"),
    adminUserId: int("adminUserId"),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    threadIdx: index("chat_messages_thread_idx").on(table.pageId, table.threadId, table.occurredAt),
    providerMessageUnique: uniqueIndex("chat_messages_provider_message_unique").on(table.provider, table.providerMessageId),
  }),
);

/** Immutable audit trail for admin actions and provider events. */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"),
    actorName: varchar("actorName", { length: 180 }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: varchar("entityId", { length: 255 }),
    pageId: varchar("pageId", { length: 128 }),
    threadId: varchar("threadId", { length: 255 }),
    metadataJson: longtext("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    actorIdx: index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  }),
);

/** Admin-maintained Thai product aliases mapped to canonical SKU labels. */
export const productAliases = mysqlTable(
  "product_aliases",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    alias: varchar("alias", { length: 180 }).notNull(),
    canonicalSku: varchar("canonicalSku", { length: 120 }).notNull(),
    canonicalLabel: varchar("canonicalLabel", { length: 255 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerAliasUnique: uniqueIndex("product_aliases_owner_alias_unique").on(table.ownerId, table.alias),
    ownerIdx: index("product_aliases_owner_idx").on(table.ownerId, table.updatedAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type VaultProject = typeof vaultProjects.$inferSelect;
export type VaultFile = typeof vaultFiles.$inferSelect;
export type VaultRevision = typeof vaultRevisions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ProductAlias = typeof productAliases.$inferSelect;
