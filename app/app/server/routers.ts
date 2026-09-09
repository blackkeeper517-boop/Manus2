import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";
import { createCanonicalAlias, fetchConversationEvidence, fetchDailyChatOrderSummary, fetchDailyOrderHistory, fetchExternalChatMessages, fetchLiveOrders, fetchLiveThreads, fetchStockProducts, fetchStockWarnings, getLiveOrderStats, listCanonicalAliases, supabaseGet, supabasePost, updateCanonicalAlias, updateProductMapAlias, updateStockProduct, type LiveOrder, type StockProduct } from "./supabase";
import { sendMetaMessage } from "./meta";
import { storagePut } from "./storage";
import * as db from "./db";

const threadInput = z.object({ pageId: z.string().min(1), threadId: z.string().min(1) });
const ownerId = (ctx: { user: { id: number } | null }) => ctx.user?.id ?? 0;
const kind = z.enum(["code", "sql", "workflow", "document", "config", "other"]);

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "drakside-system", time: new Date().toISOString() })),

  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { maxAge: -1, httpOnly: true, secure: true, sameSite: "none", path: "/" }); return { success: true }; }),
  }),

  orders: router({
    threads: publicProcedure.query(() => fetchLiveThreads()),
    live: publicProcedure.input(z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(500).default(300) }).optional()).query(async ({ input }) => { const orders = await fetchLiveOrders(input?.search); return { orders: orders.slice(0, input?.limit ?? 300), stats: getLiveOrderStats(orders), fetchedAt: new Date().toISOString() }; }),
    forThread: publicProcedure.input(threadInput).query(async ({ input }): Promise<LiveOrder[]> => { try { return await supabaseGet<LiveOrder[]>(`vw_payload_room_status?page_id=eq.${encodeURIComponent(input.pageId)}&conversation_key=eq.${encodeURIComponent(input.threadId)}&select=*`); } catch { return []; } }),
    chatEvidence: publicProcedure.input(threadInput).query(({ input }) => fetchConversationEvidence(input.pageId, input.threadId)),
    searchEvidence: publicProcedure.input(z.object({ q: z.string().optional(), pageId: z.string().optional(), conversationKey: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) })).query(async ({ input }) => { const filters = ["select=*", `limit=${input.limit}`, "order=occurred_at.desc"]; if (input.q?.trim()) filters.push(`search_text=ilike.*${encodeURIComponent(input.q.trim())}*`); if (input.pageId?.trim()) filters.push(`page_id=eq.${encodeURIComponent(input.pageId.trim())}`); if (input.conversationKey?.trim()) filters.push(`conversation_key=eq.${encodeURIComponent(input.conversationKey.trim())}`); return supabaseGet<unknown[]>(`vw_chat_customer_evidence_history?${filters.join("&")}`); }),
    dailyChatSummary: publicProcedure.input(z.object({ date: z.string() })).query(({ input }) => fetchDailyChatOrderSummary(input.date)),
    dailyOrderHistory: publicProcedure.input(z.object({ date: z.string(), search: z.string().optional() })).query(({ input }) => fetchDailyOrderHistory(input.date, input.search)),
    generateSummary: publicProcedure.input(z.object({ rawText: z.string(), pageId: z.string().optional(), threadId: z.string().optional(), customerName: z.string().optional(), product: z.string().optional(), cod: z.string().optional() })).mutation(({ input }) => ({ orderNumber: "", customerName: input.customerName ?? "", phone: "", address: input.rawText, product: input.product ?? "", cod: input.cod ?? "ไม่ระบุ", copyText: input.rawText, timingMs: { total: 0, parse: 0, dataLookup: 0, audit: 0 } })),
    summaryTimings: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(8) })).query(() => [] as Array<{ id: number; createdAt: string; orderNumber: string; pageId: string; threadId: string; metadata: Record<string, unknown> }>),
    confirmations: publicProcedure.query(() => [] as Array<{ pageId: string; threadId: string }>),
    confirmFromChat: publicProcedure.input(threadInput.extend({ customerName: z.string().optional(), customerId: z.string().optional(), evidenceText: z.string().optional() })).mutation(({ input }) => ({ ok: true, ...input })),
  }),

  chat: router({
    messages: publicProcedure.input(threadInput).query(({ input }) => fetchExternalChatMessages(input.pageId, input.threadId)),
    sendReply: publicProcedure.input(z.object({ pageId: z.string(), threadId: z.string(), recipientId: z.string(), text: z.string().optional(), imageUrl: z.string().optional(), stickerId: z.string().optional() })).mutation(async ({ input, ctx }) => { const result = await sendMetaMessage(input); await db.saveChatMessage({ pageId: input.pageId, threadId: input.threadId, senderId: input.recipientId, senderType: "admin", direction: "outbound", text: input.text, attachments: input.imageUrl ? [{ url: input.imageUrl }] : undefined, adminUserId: ctx.user?.id }); return result; }),
    simulateSend: publicProcedure.input(z.object({ pageId: z.string(), threadId: z.string(), recipientId: z.string(), kind: z.enum(["text", "image"]), text: z.string().optional(), imageUrl: z.string().optional() })).mutation(({ input }) => ({ dryRun: true, payload: input })),
    uploadImage: publicProcedure.input(z.object({ fileName: z.string(), contentType: z.string(), base64: z.string() })).mutation(async ({ input }) => { const comma = input.base64.indexOf(","); const raw = comma >= 0 ? input.base64.slice(comma + 1) : input.base64; return storagePut(`chat/${input.fileName}`, Buffer.from(raw, "base64"), input.contentType); }),
    metaErrors: publicProcedure.query(() => []),
    deliveryHealth: publicProcedure.query(async () => { try { const rows = await supabaseGet<unknown[]>("vw_trial_label_delivery_queue?select=*&limit=100"); return { ok: true, pending: rows.length, rows, failed: [] as unknown[], sent: [] as unknown[] }; } catch (error) { return { ok: false, pending: 0, error: String(error), failed: [] as unknown[], sent: [] as unknown[], rows: [] as unknown[] }; } }),
  }),

  stock: router({
    products: publicProcedure.query(() => fetchStockProducts()),
    warnings: publicProcedure.query(() => fetchStockWarnings()),
    mappingSummary: publicProcedure.query(async () => { const products: StockProduct[] = await fetchStockProducts(); const missingAlias = products.filter(item => !item.aliases?.trim()).length; const missingSku = products.filter(item => !item.sku?.trim()).length; const bySku = new Set<string>(); const duplicateSku = products.filter(item => { if (!item.sku || bySku.has(item.sku)) return Boolean(item.sku); bySku.add(item.sku); return false; }).length; return { products, total: products.length, mapped: products.length - missingAlias, missingAlias, missingSku, duplicateSku }; }),
    update: publicProcedure.input(z.object({ id: z.number(), stockQty: z.number().optional(), stockStatus: z.string().optional(), labelDisplay: z.string().optional(), unitPrice: z.number().optional() })).mutation(({ input }) => updateStockProduct(input.id, input)),
    updateAlias: publicProcedure.input(z.object({ sku: z.string(), alias: z.string() })).mutation(({ input }) => updateProductMapAlias(input.sku, input.alias)),
  }),

  productAliases: router({
    list: publicProcedure.query(async () => (await listCanonicalAliases()).map(row => ({ id: Number(row.id), alias: String(row.alias_text ?? ""), canonicalSku: String(row.sku ?? ""), canonicalLabel: String(row.product_name ?? row.note ?? ""), isActive: row.mapping_status === "APPROVED" }))),
    catalog: publicProcedure.query(() => fetchStockProducts()),
    create: publicProcedure.input(z.object({ alias: z.string(), canonicalSku: z.string(), canonicalLabel: z.string() })).mutation(({ input }) => createCanonicalAlias(input)),
    update: publicProcedure.input(z.object({ id: z.number(), alias: z.string(), canonicalSku: z.string(), canonicalLabel: z.string(), isActive: z.boolean().optional() })).mutation(({ input }) => updateCanonicalAlias(input)),
  }),

  vault: router({
    verifyAccessCode: publicProcedure.input(z.object({ code: z.string() })).mutation(({ input }) => ({ ok: Boolean(process.env.VAULT_ACCESS_CODE && input.code === process.env.VAULT_ACCESS_CODE) })),
    projects: adminProcedure.query(({ ctx }) => db.listVaultProjects(ownerId(ctx))),
    stats: adminProcedure.query(({ ctx }) => db.getVaultStats(ownerId(ctx))),
    files: adminProcedure.input(z.object({ projectId: z.number(), search: z.string().optional() })).query(({ ctx, input }) => db.listVaultFiles(ownerId(ctx), input.projectId, input.search)),
    file: adminProcedure.input(z.object({ fileId: z.number() })).query(({ ctx, input }) => db.getVaultFile(ownerId(ctx), input.fileId)),
    createProject: adminProcedure.input(z.object({ name: z.string(), description: z.string().optional(), category: z.string().optional() })).mutation(({ ctx, input }) => db.createVaultProject(ownerId(ctx), input)),
    createFile: adminProcedure.input(z.object({ projectId: z.number(), path: z.string(), title: z.string(), language: z.string(), kind, content: z.string() })).mutation(({ ctx, input }) => db.createVaultFile(ownerId(ctx), input)),
    updateFile: adminProcedure.input(z.object({ fileId: z.number(), projectId: z.number(), path: z.string(), title: z.string(), language: z.string(), kind, content: z.string(), isFavorite: z.boolean().optional() })).mutation(({ ctx, input: { fileId, ...input } }) => db.updateVaultFile(ownerId(ctx), fileId, input)),
  }),

  ai: router({ chat: publicProcedure.input(z.object({ messages: z.array(z.unknown()) })).mutation(() => ({ text: "AI endpoint is not configured" })) }),
  delivery: router({ pending: publicProcedure.input(z.object({ roomKey: z.string().optional() }).optional()).query(async ({ input }) => { const filter = input?.roomKey ? `&room_key=eq.${encodeURIComponent(input.roomKey)}` : ""; return supabaseGet<unknown[]>(`vw_trial_label_delivery_queue?select=*${filter}&order=created_at.asc&limit=100`); }), claim: publicProcedure.input(z.object({ roomKey: z.string(), worker: z.string().default("vercel") })).mutation(({ input }) => supabasePost<unknown>("rpc/claim_view_order", { p_order_id: Number(input.roomKey) })) }),
});

export type AppRouter = typeof appRouter;
