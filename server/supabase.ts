import { listStoredChatMessages } from "./db";

export type LiveOrderItem = {
  id?: number;
  upsert_key?: string | null;
  order_number?: string | null;
  sku?: string | null;
  th_name?: string | null;
  emoji?: string | null;
  display_for_packer?: string | null;
  telegram_final_mapped?: string | null;
  label_display?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  qty?: number | null;
  unit_price?: number | null;
  expected_cod?: number | null;
  cod_amount?: number | null;
};

export type LiveOrder = {
  id: number;
  upsert_key: string | null;
  order_number: string;
  order_date: string | null;
  order_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  customer_name: string | null;
  facebook_name: string | null;
  phone: string | null;
  full_address: string | null;
  address_display_packer: string | null;
  page_name: string | null;
  page_id: string | null;
  thread_id: string | null;
  threadId: string | null;
  cod_amount: number | null;
  expected_cod: number | null;
  sku: string | null;
  th_name: string | null;
  emoji: string | null;
  display_for_packer: string | null;
  label_display: string | null;
  telegram_status: string | null;
  order_status: string | null;
  audit_status: string | null;
  audit_flags: string | null;
  cod_check_status: string | null;
  is_ready_to_pack: boolean;
  telegram_message: string | null;
  telegram_copy_text: string | null;
  telegram_chat_id: string | null;
  source_text: string | null;
  raw_text_with_phone: string | null;
  raw_text_with_phone_timed: string | null;
  full_chunk_text: string | null;
  chat_timeline: string[];
  items_json?: unknown;
  items_text?: string | null;
  items_count?: number | null;
  total_quantity?: number | null;
  items: LiveOrderItem[];
};

export type LiveOrderStats = {
  total: number;
  mapped: number;
  review: number;
  codCheck: number;
  sent: number;
  pages: number;
};

export type LiveThread = {
  key: string;
  pageName: string;
  pageId: string | null;
  threadId: string | null;
  customerId: string | null;
  latestAt: string | null;
  latestOrderNumber: string;
  customerName: string | null;
  preview: string;
  orderCount: number;
  unread: boolean;
  sentCount: number;
  messageCount: number;
  orders: LiveOrder[];
  chatTimeline: string[];
  searchText: string;
};

export type LiveProductMapping = {
  sku: string;
  label: string;
  price: number | null;
  emoji: string | null;
  aliases?: string | null;
};

export type StockProduct = LiveProductMapping & {
  id: number;
  thName: string | null;
  stockQty: number | null;
  stockStatus: string | null;
  status: string | null;
  updatedAt: string | null;
};

export type StockWarning = {
  kind: "duplicate_sku" | "missing_sku";
  sku: string | null;
  label: string | null;
  count?: number;
};

export type ExternalChatMessage = {
  id: number;
  providerMessageId: string | null;
  pageId: string;
  pageName: string | null;
  threadId: string;
  senderId: string;
  senderName: string | null;
  customerName: string | null;
  senderType: "customer" | "page";
  side: "left" | "right";
  direction: "inbound" | "outbound";
  text: string | null;
  attachmentsJson: string | null;
  adminUserId?: number | null;
  occurredAt: string | null;
  createdAt: string | null;
};

const orderSelect = [
  "id", "upsert_key", "order_number", "order_date", "order_time", "created_at", "updated_at",
  "customer_name", "facebook_name", "phone", "full_address", "address_display_packer",
  "page_name", "page_id", "thread_id", "threadId", "cod_amount", "expected_cod", "sku", "th_name", "emoji",
  "display_for_packer", "final_display_for_packer", "raw_text", "raw_text_with_phone", "raw_text_with_phone_timed", "full_chunk_text", "chat_timeline", "addressclean", "short_address", "single_cleaned_block", "bubble_window", "qty", "telegram_sent", "extracted_phone", "has_phone", "has_cod", "telegram_status", "order_status", "audit_status", "audit_flags",
  "cod_check_status", "is_ready_to_pack", "telegram_message", "telegram_copy_text", "telegram_chat_id", "clean_text", "single_cleaned_block", "telegram_body", "packer_copy_text", "source_system",
].join(",");
const legacyOrderSelect = orderSelect.split(",").filter(field => !["packer_copy_text", "source_system", "final_display_for_packer", "raw_text", "raw_text_with_phone", "raw_text_with_phone_timed", "full_chunk_text", "chat_timeline", "addressclean", "short_address", "single_cleaned_block", "bubble_window", "qty", "telegram_sent", "extracted_phone", "has_phone", "has_cod"].includes(field)).join(",");

/* legacy item select intentionally removed: bb_orders is canonical */
const itemSelect = "";

const recentOrderCache = new Map<string, { expiresAt: number; value: LiveOrder[] }>();
const ORDER_CACHE_TTL_MS = 30_000;

function config() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error("Supabase secrets are not configured");
  return { baseUrl, key };
}

export async function supabaseGet<T>(path: string): Promise<T> {
  const { baseUrl, key } = config();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<T>;
}

export async function supabasePost<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl, key } = config();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<T>;
}

async function getRows<T>(table: string, select: string, limit: number) {
  const { baseUrl, key } = config();
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    throw new Error(`Supabase ${table} returned HTTP ${response.status}${details ? `: ${details}` : ""}`);
  }
  return response.json() as Promise<T[]>;
}

function text(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function timeline(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/\n(?=\d{1,2}\/\d{1,2}\/\d{2,4})/).map(item => item.trim()).filter(Boolean);
  return [];
}

function bodyField(row: Record<string, unknown>, field: string) {
  const body = row.telegram_body;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>)[field] : undefined;
}

function firstText(row: Record<string, unknown>, ...fields: string[]) {
  for (const field of fields) { const value = text(row[field]); if (value?.trim()) return value; }
  return null;
}

function customerNameFromRow(row: Record<string, unknown>) {
  const candidate = firstText(row, "customer_name", "facebook_name");
  const facebook = firstText(row, "facebook_name");
  if (facebook && candidate && (/^\d{1,2}$/.test(candidate.trim()) || /^\d{1,2}[/-]\d{1,2}/.test(candidate.trim()))) return facebook;
  return candidate;
}

function sortNewest(a: { created_at?: string | null; order_time?: string | null }, b: { created_at?: string | null; order_time?: string | null }) {
  const aTime = Date.parse(String(a.created_at ?? a.order_time ?? "")) || 0;
  const bTime = Date.parse(String(b.created_at ?? b.order_time ?? "")) || 0;
  return bTime - aTime;
}

function normalizeItem(row: Record<string, unknown>): LiveOrderItem {
  return {
    id: number(row.id) ?? undefined,
    upsert_key: text(row.upsert_key),
    order_number: text(row.order_number),
    sku: text(row.sku),
    th_name: text(row.th_name),
    emoji: text(row.emoji),
    display_for_packer: text(row.display_for_packer),
    telegram_final_mapped: text(row.telegram_final_mapped),
    label_display: text(row.label_display),
    product_name: text(row.product_name),
    quantity: number(row.quantity ?? row.total_qty),
    qty: number(row.qty ?? row.total_qty),
    unit_price: number(row.unit_price ?? row.total),
    expected_cod: number(row.expected_cod),
    cod_amount: number(row.cod_amount),
  };
}

function itemLinesFromOrder(row: Record<string, unknown>): LiveOrderItem[] {
  const raw = row.items_json;
  let parsed: unknown[] = [];
  if (Array.isArray(raw)) parsed = raw;
  else if (typeof raw === "string") { try { const value = JSON.parse(raw); if (Array.isArray(value)) parsed = value; } catch { /* keep fallback */ } }
  if (parsed.length) return parsed.filter(item => item && typeof item === "object").map(item => normalizeItem(item as Record<string, unknown>));
  if (row.sku || row.th_name || row.display_label || row.display_for_packer) return [normalizeItem(row)];
  return [];
}

function normalizeOrder(row: Record<string, unknown>, items: LiveOrderItem[]): LiveOrder {
  const orderNumber = text(row.order_number) ?? `#${text(row.id) ?? "unknown"}`;
  return {
    id: number(row.id) ?? 0,
    upsert_key: text(row.upsert_key),
    order_number: orderNumber,
    order_date: text(row.order_date),
    order_time: text(row.order_time),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    customer_name: customerNameFromRow(row),
    facebook_name: text(row.facebook_name),
    phone: firstText(row, "phone", "extracted_phone"),
    full_address: firstText(row, "full_address", "address_display_packer", "addressclean", "short_address", "parsedLocationOnly"),
    address_display_packer: text(row.address_display_packer),
    page_name: text(row.page_name),
    page_id: text(row.page_id),
    thread_id: text(row.thread_id),
    threadId: text(row.threadId),
    cod_amount: number(row.cod_amount) ?? number(row.expected_cod) ?? number(bodyField(row, "cod_amount")) ?? number(bodyField(row, "total_cod")),
    expected_cod: number(row.expected_cod) ?? number(row.cod_amount),
    sku: text(row.sku),
    th_name: text(row.th_name),
    emoji: text(row.emoji),
    display_for_packer: firstText(row, "display_for_packer", "final_display_for_packer"),
    label_display: text(row.label_display) ?? text(row.display_label),
    telegram_status: text(row.telegram_status),
    order_status: text(row.order_status),
    audit_status: text(row.audit_status),
    audit_flags: text(row.audit_flags),
    cod_check_status: text(row.cod_check_status),
    is_ready_to_pack: bool(row.is_ready_to_pack),
    telegram_message: text(row.telegram_message),
    telegram_copy_text: text(row.telegram_copy_text),
    telegram_chat_id: text(row.telegram_chat_id),
    source_text: firstText(row, "raw_text", "clean_text", "single_cleaned_block", "full_chunk_text"),
    raw_text_with_phone: text(row.raw_text_with_phone ?? bodyField(row, "raw_text_with_phone")),
    raw_text_with_phone_timed: text(row.raw_text_with_phone_timed ?? bodyField(row, "raw_text_with_phone_timed")),
    full_chunk_text: text(row.full_chunk_text ?? bodyField(row, "full_chunk_text")),
    chat_timeline: timeline(row.chat_timeline ?? bodyField(row, "chat_timeline") ?? row.raw_text_with_phone_timed ?? row.full_chunk_text ?? row.clean_text ?? row.telegram_copy_text ?? row.telegram_message),
    items_json: row.items_json ?? null,
    items_text: text(row.items_text ?? row.packer_copy_text),
    items_count: number(row.items_count),
    total_quantity: number(row.total_quantity),
    items,
  };
}

async function getRowsWithFallback<T>(preferredTable: string, fallbackTable: string, select: string, limit: number) {
  try {
    return await getRows<T>(preferredTable, select, limit);
  } catch (error) {
    // During the migration bb_orders may exist with an older column shape.
    // Retry the established bb_order table for both missing-table and HTTP 400 schema errors.
    if (!/400|404|42P01|relation|column|does not exist/i.test(String(error))) throw error;
    try {
      return await getRows<T>(fallbackTable, select, limit);
    } catch (fallbackError) {
      throw new Error(`${String(error)}; fallback ${String(fallbackError)}`);
    }
  }
}

export async function fetchLiveOrders(search?: string) {
  let rawOrders: Array<Record<string, unknown>>;
  try {
    rawOrders = await getRows<Record<string, unknown>>("bb_orders", orderSelect, 3000);
  } catch (error) {
    if (!/400|column|does not exist/i.test(String(error))) throw error;
    console.warn("[NIGHTOPS] bb_orders is missing migration columns; using compatible select");
    rawOrders = await getRows<Record<string, unknown>>("bb_orders", legacyOrderSelect, 3000);
  }
  let itemRows: Array<Record<string, unknown>> = [];
  try {
    itemRows = await getRows<Record<string, unknown>>("bb_order_items", "*", 10000);
  } catch (error) {
    // Keep old deployments working until the small bb_order_items migration is run.
    if (!/400|404|42P01|relation|does not exist/i.test(String(error))) throw error;
  }
  const itemsByKey = new Map<string, LiveOrderItem[]>();
  for (const row of itemRows) {
    const key = text(row.order_key) ?? text(row.order_number);
    if (!key) continue;
    const item = normalizeItem(row);
    itemsByKey.set(key, [...(itemsByKey.get(key) ?? []), item]);
  }
  const rawOrderByKey = new Map<string, Record<string, unknown>>();
  for (const row of rawOrders) {
    const key = text(row.order_number) ?? text(row.upsert_key) ?? `id:${text(row.id)}`;
    rawOrderByKey.set(key, row);
  }
  const orders = rawOrders.map(row => {
    const key = text(row.upsert_key) ?? text(row.order_number) ?? `id:${text(row.id)}`;
    return normalizeOrder(row, itemsByKey.get(key)?.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) ?? itemLinesFromOrder(row));
  }).sort(sortNewest);

  const query = search?.trim().toLowerCase();
  if (!query) return orders;
  return orders.filter(order => [order.order_number, order.customer_name, order.facebook_name, order.phone, order.sku, order.th_name, order.page_name].some(value => String(value ?? "").toLowerCase().includes(query)));
}

export function getLiveOrderStats(orders: LiveOrder[]): LiveOrderStats {
  const pages = new Set(orders.map(order => order.page_name).filter(Boolean));
  const mapped = orders.filter(order => order.is_ready_to_pack || /ready|mapped|พร้อม|แมป|ผ่าน/i.test(`${order.audit_status ?? ""} ${order.order_status ?? ""}`)).length;
  const codCheck = orders.filter(order => {
    const status = String(order.cod_check_status ?? "").toUpperCase();
    return status !== "" && status !== "PASS";
  }).length;
  return {
    total: orders.length,
    mapped,
    review: Math.max(orders.length - mapped, 0),
    codCheck,
    sent: orders.filter(order => String(order.telegram_status ?? "").toUpperCase() === "SENT").length,
    pages: pages.size,
  };
}

export async function fetchLiveOrder(orderNumber: string) {
  const orders = await fetchLiveOrders(orderNumber);
  return orders.find(order => order.order_number === orderNumber) ?? null;
}

export async function fetchOrdersForThread(pageId: string, threadId: string): Promise<LiveOrder[]> {
  const cacheKey = `${pageId}::${threadId}`;
  const cached = recentOrderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const { baseUrl, key } = config();
  const rpcResponse = await fetch(`${baseUrl}/rest/v1/rpc/get_latest_orders_for_thread`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_page_id: pageId, p_thread_id: threadId, p_limit: 20 }),
  });
  if (rpcResponse.ok) {
    const rows = await rpcResponse.json() as Array<Record<string, unknown>>;
    const result = rows.map(row => normalizeOrder(row, itemLinesFromOrder(row))).sort(sortNewest);
    recentOrderCache.set(cacheKey, { expiresAt: Date.now() + ORDER_CACHE_TTL_MS, value: result });
    return result;
  }
  const request = async (table: string, select = orderSelect) => {
    const url = new URL(`${baseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("page_id", `eq.${pageId}`);
    url.searchParams.set("thread_id", `eq.${threadId}`);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "20");
    return fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  };
  let response = await request("bb_orders");
  if (!response.ok && /400|column|does not exist/i.test(await response.clone().text())) response = await request("bb_orders", legacyOrderSelect);
  if (!response.ok && /404|42P01|relation|does not exist/i.test(await response.clone().text())) response = await request("bb_order", legacyOrderSelect);
  if (!response.ok) throw new Error(`Supabase order thread lookup returned HTTP ${response.status}`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  const result = rows.map(row => normalizeOrder(row, itemLinesFromOrder(row))).sort(sortNewest);
  recentOrderCache.set(cacheKey, { expiresAt: Date.now() + ORDER_CACHE_TTL_MS, value: result });
  return result;
}

export function clearRecentOrderCache() {
  recentOrderCache.clear();
}

export async function fetchLiveProductMappings(): Promise<LiveProductMapping[]> {
  const [productResult, mapResult] = await Promise.allSettled([
    getRows<Record<string, unknown>>("product_master", "sku,label_display,display_for_packer,name_standard,unit_price,emoji,alias", 1000),
    getRows<Record<string, unknown>>("product_map_master", "sku,alias,alias_text", 5000),
  ]);
  if (productResult.status === "rejected") throw productResult.reason;
  const rows = productResult.value;
  const mappedAliases = new Map<string, string>();
  if (mapResult.status === "fulfilled") for (const row of mapResult.value) {
    const sku = String(row.sku ?? "").trim();
    const alias = text(row.alias ?? row.alias_text);
    if (sku && alias) mappedAliases.set(sku, alias);
  }
  return rows.map(row => ({
    sku: String(row.sku ?? ""),
    label: String(row.label_display ?? row.display_for_packer ?? row.name_standard ?? row.sku ?? ""),
    price: number(row.unit_price),
    emoji: text(row.emoji),
    aliases: mappedAliases.get(String(row.sku ?? "")) ?? text(row.alias),
  })).filter(item => item.sku && item.label).sort((a, b) => a.sku.localeCompare(b.sku));
}

export async function fetchStockProducts(): Promise<StockProduct[]> {
  const [productResult, mapResult] = await Promise.allSettled([
    getRows<Record<string, unknown>>("product_master", "id,sku,label_display,display_for_packer,name_standard,unit_price,emoji,alias,th_name,stock_qty,stock_status,status,updated_at", 2000),
    getRows<Record<string, unknown>>("product_map_master", "sku,alias,alias_text,alias_norm", 5000),
  ]);
  if (productResult.status === "rejected") throw productResult.reason;
  const rows = productResult.value;
  const mappedAliases = new Map<string, string>();
  if (mapResult.status === "fulfilled") for (const row of mapResult.value) {
    const sku = String(row.sku ?? "").trim();
    const alias = text(row.alias ?? row.alias_text);
    if (sku && alias) mappedAliases.set(sku, alias);
  }
  return rows.map(row => ({
    id: number(row.id) ?? 0,
    sku: String(row.sku ?? ""),
    label: String(row.label_display ?? row.display_for_packer ?? row.name_standard ?? row.sku ?? ""),
    price: number(row.unit_price),
    emoji: text(row.emoji),
    aliases: mappedAliases.get(String(row.sku ?? "")) ?? text(row.alias),
    thName: text(row.th_name),
    stockQty: number(row.stock_qty),
    stockStatus: text(row.stock_status),
    status: text(row.status),
    updatedAt: text(row.updated_at),
  })).filter(item => item.sku && item.label).sort((a, b) => a.label.localeCompare(b.label, "th"));
}

export async function updateStockProduct(id: number, input: { stockQty?: number; stockStatus?: string; labelDisplay?: string; unitPrice?: number }) {
  const { baseUrl, key } = config();
  const patch: Record<string, unknown> = {};
  if (input.stockQty !== undefined) patch.stock_qty = input.stockQty;
  if (input.stockStatus !== undefined) patch.stock_status = input.stockStatus;
  if (input.labelDisplay !== undefined) patch.label_display = input.labelDisplay;
  if (input.unitPrice !== undefined) patch.unit_price = input.unitPrice;
  const response = await fetch(`${baseUrl}/rest/v1/product_master?id=eq.${encodeURIComponent(String(id))}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) });
  if (!response.ok) throw new Error(`Supabase product_master update returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return fetchStockProducts();
}

export async function fetchStockWarnings(): Promise<StockWarning[]> {
  const result = await getRows<Record<string, unknown>>("product_master", "id,sku,label_display,th_name", 5000);
  const warnings: StockWarning[] = [];
  const bySku = new Map<string, Array<Record<string, unknown>>>();
  for (const row of result) {
    const sku = String(row.sku ?? "").trim();
    if (!sku) warnings.push({ kind: "missing_sku", sku: null, label: text(row.th_name ?? row.label_display) });
    else bySku.set(sku, [...(bySku.get(sku) ?? []), row]);
  }
  bySku.forEach((rows, sku) => { if (rows.length > 1) warnings.push({ kind: "duplicate_sku", sku, label: text(rows[0]?.th_name ?? rows[0]?.label_display), count: rows.length }); });
  return warnings;
}

export async function updateProductMapAlias(sku: string, alias: string) {
  const { baseUrl, key } = config();
  const cleanAlias = alias.trim();
  const mappedBody = { alias: cleanAlias || null, alias_text: cleanAlias || null, alias_norm: cleanAlias ? cleanAlias.toLowerCase() : null, updated_at: new Date().toISOString() };
  const response = await fetch(`${baseUrl}/rest/v1/product_map_master?sku=eq.${encodeURIComponent(sku)}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(mappedBody) });
  if (!response.ok) throw new Error(`Supabase product_map_master alias update returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const master = await fetch(`${baseUrl}/rest/v1/product_master?select=id,alias&sku=eq.${encodeURIComponent(sku)}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (master.ok) {
    const rows = await master.json() as Array<{ id: number; alias?: string | null }>;
    const row = rows[0];
    if (row) {
      const aliases = String(row.alias ?? "").split(/[,\n|]+/).map(value => value.trim()).filter(Boolean).filter(value => value.toLowerCase() !== cleanAlias.toLowerCase());
      if (cleanAlias) aliases.push(cleanAlias);
      const sync = await fetch(`${baseUrl}/rest/v1/product_master?id=eq.${encodeURIComponent(String(row.id))}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ alias: aliases.join(", ") || null }) });
      if (!sync.ok) throw new Error(`Supabase product_master alias sync returned HTTP ${sync.status}`);
    }
  }
  return { ok: true, sku, alias: cleanAlias };
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function fetchExternalChatMessages(pageId?: string, threadId?: string, limit = 2000): Promise<ExternalChatMessage[]> {
  const { baseUrl, key } = config();
  async function readTable(table: string) {
    const select = table === "chat_customer_messages"
      ? "id,source_message_id,page_id,page_name,conversation_key,customer_id,customer_name,message_text,attachments_json,occurred_at,synced_at"
      : "id,source_message_id,page_id,page_name,conversation_key,page_sender_id,page_sender_name,message_text,attachments_json,occurred_at,synced_at";
    const params = new URLSearchParams({ select, order: "occurred_at.desc", limit: String(limit) });
    if (pageId) params.set("page_id", `eq.${pageId}`);
    if (threadId) params.set("conversation_key", `eq.${threadId}`);
    let response = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) {
      // Keep the Chat Hub usable if a deployment has an older table shape.
      const fallback = new URL(`${baseUrl}/rest/v1/${table}`);
      fallback.searchParams.set("select", "*");
      fallback.searchParams.set("order", "occurred_at.desc");
      fallback.searchParams.set("limit", String(limit));
      if (pageId) fallback.searchParams.set("page_id", `eq.${pageId}`);
      if (threadId) fallback.searchParams.set("conversation_key", `eq.${threadId}`);
      response = await fetch(fallback, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    }
    if (!response.ok) throw new Error(`Supabase ${table} returned HTTP ${response.status}`);
    return response.json() as Promise<Array<Record<string, unknown>>>;
  }
  try {
    const [customersResult, pagesResult] = await Promise.allSettled([readTable("chat_customer_messages"), readTable("chat_page_messages")]);
    const customers = customersResult.status === "fulfilled" ? customersResult.value : [];
    const pages = pagesResult.status === "fulfilled" ? pagesResult.value : [];
    if (customersResult.status === "rejected" && pagesResult.status === "rejected") throw customersResult.reason;
    const pageNames = new Map(pages.map(row => [String(row.page_id ?? ""), text(row.page_name)]));
    const rows: Array<Record<string, unknown> & { senderId: unknown; senderName: unknown; senderType: "customer" | "page"; side: "left" | "right"; direction: "inbound" | "outbound" }> = [
      ...customers.map(row => ({ ...row, page_name: pageNames.get(String(row.page_id ?? "")) ?? row.page_name, senderId: row.customer_id, senderName: row.customer_name, customerName: row.customer_name, senderType: "customer" as const, side: "left" as const, direction: "inbound" as const })),
      ...pages.map(row => ({ ...row, senderId: row.page_sender_id ?? row.page_id, senderName: row.page_sender_name, customerName: null, senderType: "page" as const, side: "right" as const, direction: "outbound" as const })),
    ];
    return rows.map((row, index) => ({
      id: Number(row.id ?? index + 1), providerMessageId: text(row.source_message_id), pageId: String(row.page_id ?? ""), pageName: text(row.page_name),
      threadId: String(row.conversation_key ?? row.conversation_id ?? row.thread_id ?? ""), senderId: String(row.senderId ?? ""), senderName: text(row.senderName), customerName: text(row.customerName), senderType: row.senderType, side: row.side, direction: row.direction,
      text: text(row.message_text), attachmentsJson: jsonText(row.attachments_json), occurredAt: text(row.occurred_at), createdAt: text(row.synced_at),
    })).sort((a, b) => (Date.parse(String(b.occurredAt ?? "")) || 0) - (Date.parse(String(a.occurredAt ?? "")) || 0));
  } catch (error) {
    if (/404|42P01|relation|does not exist/i.test(String(error))) return [];
    throw error;
  }
}

export async function fetchDailyChatOrderSummary(date: string) {
  const messages = await fetchExternalChatMessages(undefined, undefined, 10000);
  const thaiDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "";
  const selected = messages.filter(message => thaiDate(message.occurredAt) === date);
  const groups = new Map<string, { pageId: string; pageName: string; threadId: string; customerName: string; customerId: string; customerMessages: number; pageMessages: number; orderSignals: number; latestAt: string | null; snippets: string[] }>();
  const codSignal = /(\bcod\b|ซีโอดี|เก็บเงินปลายทาง|ปลายทาง|ยอด\s*[0-9,]+\s*(บาท|฿)?|[0-9,]+\s*บาท)/i;
  const intentSignal = /(สั่ง|เอาเลย|เอา\s*ค่ะ?|รับ\s*ค่ะ?|ขอ\s*รับ|จอง|สนใจ|ตกลง|ยืนยัน|คอนเฟิร์ม|โอน|เก็บปลายทาง)/i;
  const productOrQuantitySignal = /(คอต|ชิ้น|กระปุก|ขวด|กล่อง|แพ็ค|แพค|สินค้า|รุ่น|สี|ตัว|\d+\s*(คอต|ชิ้น|ขวด|กล่อง|แพ็ค|แพค)?)/i;
  const deliverySignal = /(0\d{8,9}|เบอร์|โทร|ที่อยู่|บ้านเลขที่|หมู่|ต\.|อ\.|จ\.|รหัสไปรษณีย์|ปลายทาง|จัดส่ง)/i;
  const isOrderSignal = (value: string) => {
    const normalized = value.replace(/[\u200b\s]+/g, " ").trim();
    if (codSignal.test(normalized)) return true;
    return (intentSignal.test(normalized) && (productOrQuantitySignal.test(normalized) || deliverySignal.test(normalized))) || (productOrQuantitySignal.test(normalized) && deliverySignal.test(normalized));
  };
  for (const message of selected) {
    const key = `${message.pageId}::${message.threadId}`;
    const group = groups.get(key) ?? { pageId: message.pageId, pageName: message.pageName ?? message.pageId, threadId: message.threadId, customerName: message.customerName ?? message.senderName ?? "ไม่ระบุลูกค้า", customerId: message.senderType === "customer" ? message.senderId : "", customerMessages: 0, pageMessages: 0, orderSignals: 0, latestAt: message.occurredAt, snippets: [] };
    if (message.senderType === "customer") { group.customerMessages += 1; if (message.text && isOrderSignal(message.text)) { group.orderSignals += 1; if (group.snippets.length < 3) group.snippets.push(message.text.slice(0, 180)); } }
    else group.pageMessages += 1;
    if ((Date.parse(message.occurredAt ?? "") || 0) > (Date.parse(group.latestAt ?? "") || 0)) group.latestAt = message.occurredAt;
    if (!group.customerName || group.customerName === "ไม่ระบุลูกค้า") group.customerName = message.customerName ?? message.senderName ?? group.customerName;
    groups.set(key, group);
  }
  const threads = Array.from(groups.values()).sort((a, b) => (b.orderSignals - a.orderSignals) || ((Date.parse(b.latestAt ?? "") || 0) - (Date.parse(a.latestAt ?? "") || 0)));
  return { date, totalMessages: selected.length, customerMessages: selected.filter(message => message.senderType === "customer").length, pageMessages: selected.filter(message => message.senderType === "page").length, threadCount: threads.length, orderSignalThreads: threads.filter(thread => thread.orderSignals > 0).length, threads, generatedAt: new Date().toISOString() };
}

function bangkokDateKey(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return "";
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (year > 2400) year -= 543;
  return `${year.toString().padStart(4, "0")}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export async function fetchDailyOrderHistory(date: string, search?: string) {
  const orders = await fetchLiveOrders(search);
  const filtered = orders.filter(order => [order.order_date, order.order_time, order.created_at].some(value => bangkokDateKey(value) === date));
  return { date, total: filtered.length, orders: filtered, source: "bb_orders" as const, generatedAt: new Date().toISOString() };
}

export async function fetchCustomerChatEvidence(pageId: string, threadId: string, limit = 500) {
  const { baseUrl, key } = config();
  const params = new URLSearchParams({
    select: "id,source_message_id,dedupe_key,page_id,page_name,conversation_key,customer_id,customer_name,sender_id,sender_name,message_text,message_type,attachments_json,image_urls,has_image,attachment_count,occurred_at,source_created_at,first_seen_at,last_seen_at,raw_payload",
    page_id: `eq.${pageId}`,
    conversation_key: `eq.${threadId}`,
    order: "occurred_at.asc",
    limit: String(limit),
  });
  const response = await fetch(`${baseUrl}/rest/v1/chat_customer_evidence?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) {
    if (response.status === 404 || response.status === 42) return [];
    throw new Error(`Supabase chat_customer_evidence returned HTTP ${response.status}`);
  }
  return response.json() as Promise<Array<Record<string, unknown>>>;
}

/**
 * Conversation evidence for the order dialog. This intentionally reads both
 * chat projections so the page's final order-summary message is not lost.
 * The immutable customer-only ledger remains separate for audit purposes.
 */
export async function fetchConversationEvidence(pageId: string, threadId: string, limit = 500) {
  const messages = await fetchExternalChatMessages(pageId, threadId, limit);
  return messages
    .sort((a, b) => (Date.parse(String(a.occurredAt ?? "")) || 0) - (Date.parse(String(b.occurredAt ?? "")) || 0))
    .map((message, index) => ({
      id: `${message.senderType}-${message.providerMessageId || index}`,
      source_message_id: message.providerMessageId,
      dedupe_key: message.providerMessageId ? `meta:${message.providerMessageId}` : null,
      page_id: message.pageId,
      page_name: message.pageName,
      conversation_key: message.threadId,
      customer_name: message.customerName,
      sender_name: message.senderName,
      speaker_type: message.senderType,
      side: message.side,
      message_text: message.text,
      attachments_json: message.attachmentsJson,
      occurred_at: message.occurredAt,
      source_created_at: message.occurredAt,
    }));
}

export async function syncProductAliasToMaster(input: { alias: string; canonicalSku: string }) {
  const { baseUrl, key } = config();
  const filter = encodeURIComponent(input.canonicalSku);
  const response = await fetch(`${baseUrl}/rest/v1/product_master?select=id,sku,alias&sku=eq.${filter}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase product_master lookup returned HTTP ${response.status}`);
  const rows = await response.json() as Array<{ id: number; sku: string; alias: string | null }>;
  const row = rows[0];
  if (!row) throw new Error(`ไม่พบ SKU ${input.canonicalSku} ใน product_master`);
  const aliases = String(row.alias ?? "").split(/[,\n|]+/).map(value => value.trim()).filter(Boolean);
  if (!aliases.some(value => value.toLowerCase() === input.alias.trim().toLowerCase())) aliases.push(input.alias.trim());
  const update = await fetch(`${baseUrl}/rest/v1/product_master?id=eq.${row.id}`, { method: "PATCH", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ alias: aliases.join(", ") }) });
  if (!update.ok) throw new Error(`Supabase product_master update returned HTTP ${update.status}`);
  return { synced: true, sku: row.sku, aliasCount: aliases.length };
}

export async function fetchLiveThreads(search?: string) {
  const externalMessages = await fetchExternalChatMessages();
  const allMessages = externalMessages;
  const groups = new Map<string, LiveThread>();
  const latestDirections = new Map<string, { inbound: number; outbound: number }>();
  for (const message of allMessages) {
    const key = `${message.pageId}::${message.threadId}`;
    const messageAt = String(message.occurredAt ?? "");
    const existing = groups.get(key);
    const thread: LiveThread = existing ?? {
      key,
      pageName: message.pageName ?? message.pageId,
      pageId: message.pageId,
      threadId: message.threadId,
      customerId: message.senderType === "customer" ? message.senderId : null,
      latestAt: messageAt,
      latestOrderNumber: "",
      customerName: message.customerName ?? (message.senderType === "customer" ? message.senderName : null),
      chatTimeline: [],
      preview: message.text ?? "มีรูปภาพแนบ",
      orderCount: 0,
      unread: false,
      sentCount: 0,
      messageCount: 0,
      orders: [],
      searchText: "",
    };
    if (!thread.customerName && message.customerName) thread.customerName = message.customerName;
    if (!thread.customerId && message.senderType === "customer" && message.senderId) thread.customerId = message.senderId;
    if ((Date.parse(messageAt) || 0) > (Date.parse(String(thread.latestAt ?? "")) || 0)) {
      thread.latestAt = messageAt;
      thread.preview = message.text ?? "มีรูปภาพแนบ";
    }
    if (message.direction === "outbound") thread.sentCount += 1;
    thread.messageCount += 1;
    thread.searchText = `${thread.searchText} ${message.text ?? ""}`.trim();
    const directionState = latestDirections.get(key) ?? { inbound: 0, outbound: 0 };
    const timestamp = Date.parse(messageAt) || 0;
    if (message.senderType === "customer") directionState.inbound = Math.max(directionState.inbound, timestamp);
    if (message.senderType === "page") directionState.outbound = Math.max(directionState.outbound, timestamp);
    latestDirections.set(key, directionState);
    groups.set(key, thread);
  }
  groups.forEach((thread, key) => {
    const directionState = latestDirections.get(key);
    thread.unread = Boolean(directionState && directionState.inbound > directionState.outbound);
  });
  let orders: LiveOrder[] = [];
  try {
    orders = await fetchLiveOrders(search);
  } catch (error) {
    console.warn("[NIGHTOPS] Chat Hub loaded without order enrichment:", error instanceof Error ? error.message : String(error));
  }
  for (const order of orders) {
    const key = `${order.page_id ?? ""}::${order.thread_id ?? order.threadId ?? ""}`;
    const thread = groups.get(key);
    if (!thread) continue;
    thread.orders.push(order);
    thread.orderCount += 1;
    if (!thread.latestOrderNumber) thread.latestOrderNumber = order.order_number;
  }
  return Array.from(groups.values()).sort((a, b) => (Date.parse(String(b.latestAt ?? "")) || 0) - (Date.parse(String(a.latestAt ?? "")) || 0));
}
