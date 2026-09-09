import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { supabaseGet, supabasePost } from "./supabase";

type Row = Record<string, any>;
const threadInput = z.object({ pageId: z.string().min(1), threadId: z.string().min(1) });

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function parseItems(order: Row): Row[] {
  const candidates = [order.items_json, order.items, order.products, order.detected_products, order.products_all_fields];
  const payloads = [order.raw_payload, order.payload, order.p_payload, order.telegram_body]
    .filter((value): value is Row => Boolean(value && typeof value === "object"));
  for (const payload of payloads) candidates.push(payload.items_json, payload.items, payload.products, payload.detected_products, payload.products_all_fields);
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate.filter((item) => item && typeof item === "object");
    if (typeof candidate === "string" && candidate.trim()) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed) && parsed.length) return parsed.filter((item) => item && typeof item === "object");
      } catch { /* preserve the order even when a legacy payload is malformed */ }
    }
  }
  const legacy = [order.sku, order.th_name, order.display_label, order.display_for_packer].some(Boolean);
  return legacy ? [{ ...order, quantity: order.quantity ?? order.qty ?? 1 }] : [];
}

function orderWithPayload(row: Row): Row {
  const items = parseItems(row);
  return {
    ...row,
    items_json: row.items_json ?? (items.length ? items : []),
    items,
    items_count: Number(row.items_count ?? items.length),
    total_quantity: Number(row.total_quantity ?? items.reduce((sum, item) => sum + Number(item.quantity ?? item.qty ?? 1), 0)),
    payload: row.raw_payload ?? row.payload ?? row.telegram_body ?? null,
    data_source: "bb_orders",
  };
}

async function chatRows(path: string, direction: "inbound" | "outbound", speaker: "customer" | "page"): Promise<Row[]> {
  const rows = await supabaseGet<Row[]>(path);
  return rows.map((row) => ({ ...row, direction, speaker_type: speaker, text: row.message_text ?? row.message_body ?? row.text ?? null, attachmentsJson: typeof row.attachments_json === "string" ? row.attachments_json : row.attachments_json ? JSON.stringify(row.attachments_json) : null, occurredAt: row.occurred_at ?? row.source_created_at ?? row.created_at ?? null, senderName: row.customer_name ?? row.page_sender_name ?? row.sender_name ?? null, senderType: speaker }));
}

async function combinedMessages(pageId: string, threadId: string): Promise<Row[]> {
  const page = encodeURIComponent(pageId);
  const thread = encodeURIComponent(threadId);
  const [customers, pages] = await Promise.all([
    chatRows(`chat_customer_messages?page_id=eq.${page}&conversation_key=eq.${thread}&select=*&order=occurred_at.asc`, "inbound", "customer"),
    chatRows(`chat_page_messages?page_id=eq.${page}&conversation_key=eq.${thread}&select=*&order=occurred_at.asc`, "outbound", "page"),
  ]);
  return [...customers, ...pages].sort((a, b) => text(a.occurred_at ?? a.source_created_at).localeCompare(text(b.occurred_at ?? b.source_created_at)));
}

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "drakside-system", time: new Date().toISOString() })),

  orders: router({
    threads: publicProcedure.query(async () => {
      // Build the thread list only from the two existing chat rooms and bb_orders.
      const [customers, pages, orders] = await Promise.all([
        supabaseGet<Row[]>("chat_customer_messages?select=*&order=occurred_at.desc&limit=3000"),
        supabaseGet<Row[]>("chat_page_messages?select=*&order=occurred_at.desc&limit=3000"),
        supabaseGet<Row[]>("bb_orders?select=*&order=created_at.desc&limit=3000"),
      ]);
      const map = new Map<string, Row>();
      const add = (row: Row, kind: "customer" | "page" | "order") => {
        const pageId = text(row.page_id || row.pageId || "PAGE_UNASSIGNED");
        const threadId = text(row.conversation_key || row.thread_id || row.threadId || row.customer_id || row.order_number || "THREAD_UNASSIGNED");
        const key = `${pageId}:${threadId}`;
        const current = map.get(key) ?? { key, pageId, threadId, pageName: text(row.page_name || "ไม่ระบุเพจ"), customerId: text(row.customer_id || ""), customerName: text(row.customer_name || row.facebook_name || "ลูกค้าใหม่"), preview: "", latestAt: "", messageCount: 0, unread: false, orderCount: 0, orders: [], chatTimeline: [], searchText: "", latestOrderNumber: "" };
        current.pageName = current.pageName === "ไม่ระบุเพจ" ? text(row.page_name || current.pageName) : current.pageName;
        current.customerName = current.customerName === "ลูกค้าใหม่" ? text(row.customer_name || row.facebook_name || current.customerName) : current.customerName;
        const at = text(row.occurred_at || row.created_at || row.order_time || row.order_time_iso);
        if (!current.latestAt || at > current.latestAt) { current.latestAt = at; current.preview = text(row.message_text || row.message_body || row.clean_text || row.display_for_packer || row.items_text); }
        if (kind !== "order") current.messageCount += 1;
        if (kind === "order") { current.orderCount += 1; current.latestOrderNumber = text(row.order_number); current.orders.push(orderWithPayload(row)); }
        current.searchText += ` ${text(row.message_text || row.message_body || row.raw_text || row.raw_payload || "")}`;
        map.set(key, current);
      };
      customers.forEach((row) => add(row, "customer"));
      pages.forEach((row) => add(row, "page"));
      orders.forEach((row) => add(row, "order"));
      return [...map.values()].sort((a, b) => text(b.latestAt).localeCompare(text(a.latestAt)));
    }),

    live: publicProcedure.input(z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(500).default(300) }).optional()).query(async ({ input }) => {
      const params = [`select=*`, `order=created_at.desc`, `limit=${input?.limit ?? 300}`];
      if (input?.search?.trim()) {
        const q = encodeURIComponent(input.search.trim());
        params.push(`or=(order_number.ilike.*${q}*,customer_name.ilike.*${q}*,phone.ilike.*${q}*)`);
      }
      const rows = await supabaseGet<Row[]>(`bb_orders?${params.join("&")}`);
      const orders = rows.map(orderWithPayload);
      const mapped = orders.filter((row) => row.items.length > 0).length;
      return { orders, stats: { total: orders.length, mapped, review: orders.length - mapped, codCheck: orders.filter((row) => !row.cod_amount && !row.expected_cod).length, pages: new Set(orders.map((row) => row.page_id).filter(Boolean)).size, sent: orders.filter((row) => text(row.telegram_status).toUpperCase() === "SENT").length } };
    }),

    dailyOrderHistory: publicProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), search: z.string().optional() })).query(async ({ input }) => {
      // Read the existing bb_orders table directly. The date is compared in
      // Bangkok time so the UI's date picker matches the shop's business day.
      const rows = await supabaseGet<Row[]>("bb_orders?select=*&order=created_at.desc&limit=3000");
      const toBangkokDate = (value: unknown) => {
        const raw = text(value);
        if (!raw) return "";
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
      };
      const needle = text(input.search).trim().toLowerCase();
      const filtered = rows.filter((row) => {
        const date = toBangkokDate(row.order_date || row.order_time || row.created_at);
        if (date !== input.date) return false;
        if (!needle) return true;
        return JSON.stringify(row).toLowerCase().includes(needle);
      }).map(orderWithPayload);
      return { date: input.date, orders: filtered, total: filtered.length };
    }),

    forThread: publicProcedure.input(threadInput).query(async ({ input }) => {
      const page = encodeURIComponent(input.pageId);
      const thread = encodeURIComponent(input.threadId);
      let rows: Row[] = [];
      try {
        rows = await supabaseGet<Row[]>(`bb_orders?page_id=eq.${page}&thread_id=eq.${thread}&select=*&order=created_at.desc`);
      } catch {
        // Some older bb_orders versions used conversation_key instead of thread_id.
        rows = await supabaseGet<Row[]>(`bb_orders?page_id=eq.${page}&conversation_key=eq.${thread}&select=*&order=created_at.desc`);
      }
      return rows.map(orderWithPayload);
    }),

    // Kept as a compatibility procedure for older UI builds; it now reads the two real chat rooms.
    chatEvidence: publicProcedure.input(threadInput).query(({ input }) => combinedMessages(input.pageId, input.threadId)),
    searchEvidence: publicProcedure.input(z.object({ q: z.string().optional(), pageId: z.string().optional(), conversationKey: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) })).query(async ({ input }) => {
      const [customers, pages] = await Promise.all([
        supabaseGet<Row[]>(`chat_customer_messages?select=*&limit=${input.limit}&order=occurred_at.desc`),
        supabaseGet<Row[]>(`chat_page_messages?select=*&limit=${input.limit}&order=occurred_at.desc`),
      ]);
      const q = text(input.q).toLowerCase();
      const rows: Row[] = [...customers.map((row): Row => ({ ...row, speaker_type: "customer" })), ...pages.map((row): Row => ({ ...row, speaker_type: "page" }))];
      return rows.filter((row) => (!input.pageId || text(row.page_id) === input.pageId) && (!input.conversationKey || text(row.conversation_key) === input.conversationKey) && (!q || JSON.stringify(row).toLowerCase().includes(q))).slice(0, input.limit);
    }),

    generateSummary: publicProcedure.input(z.object({ rawText: z.string(), customerName: z.string().optional(), product: z.string().optional(), cod: z.string().optional() })).mutation(({ input }) => ({ orderNumber: "", customerName: input.customerName ?? "", phone: "", address: input.rawText, product: input.product ?? "", cod: input.cod ?? "ไม่ระบุ", copyText: input.rawText, timingMs: { total: 0, parse: 0, dataLookup: 0, audit: 0 } })),
    summaryTimings: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(8) })).query(() => []),
    confirmations: publicProcedure.query(() => []),
    confirmFromChat: publicProcedure.input(threadInput.extend({ customerName: z.string().optional(), customerId: z.string().optional(), evidenceText: z.string().optional() })).mutation(({ input }) => ({ ok: true, ...input })),
  }),

  chat: router({
    messages: publicProcedure.input(threadInput).query(({ input }) => combinedMessages(input.pageId, input.threadId)),
    sendReply: publicProcedure.input(z.object({ pageId: z.string(), threadId: z.string(), recipientId: z.string(), text: z.string().optional(), imageUrl: z.string().optional(), stickerId: z.string().optional() })).mutation(() => { throw new Error("Meta send API is not configured; message was not sent"); }),
    simulateSend: publicProcedure.input(z.object({ pageId: z.string(), threadId: z.string(), recipientId: z.string(), kind: z.enum(["text", "image"]), text: z.string().optional(), imageUrl: z.string().optional() })).mutation(({ input }) => ({ dryRun: true, payload: input })),
    uploadImage: publicProcedure.input(z.object({ fileName: z.string(), contentType: z.string(), base64: z.string() })).mutation(() => { throw new Error("Image upload is not configured; image was not uploaded"); }),
    metaErrors: publicProcedure.query(() => []),
  }),

  delivery: router({
    pending: publicProcedure.input(z.object({ roomKey: z.string().optional() }).optional()).query(async ({ input }) => {
      const filter = input?.roomKey ? `&room_key=eq.${encodeURIComponent(input.roomKey)}` : "";
      return supabaseGet<unknown[]>(`vw_room_delivery_pending?select=*${filter}&order=created_at.asc&limit=100`);
    }),
    claim: publicProcedure.input(z.object({ roomKey: z.string(), worker: z.string().default("vercel") })).mutation(({ input }) => supabasePost<unknown>("rpc/claim_room_delivery", { p_room_key: input.roomKey, p_worker: input.worker })),
  }),
});

export type AppRouter = typeof appRouter;
