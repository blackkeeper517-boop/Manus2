// n8n Code node: 🧱 BB_ORDERS_CANONICAL_PAYLOAD
// Mode: Run Once for All Items
// Place immediately before the Supabase bb_orders Upsert node.
// This keeps every order in one canonical row and stores 2-3+ products in items_json.

const out = [];

function asNumber(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function first(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}
function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function hasCod(r) {
  const value = first(r.cod_amount, r.expected_cod, r.total_cod, r.calculated_cod);
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric > 0 : true;
}
function normalizeItems(r) {
  const source = r.items_json ?? r.items ?? r.products ?? r.product_lines ?? r.products_all_fields ?? [];
  const list = Array.isArray(source) ? source : [];
  if (list.length) return list.map(item => ({
    sku: first(item.sku, item.SKU, item.canonical_sku) ?? null,
    th_name: first(item.th_name, item.product_name, item.name) ?? null,
    label_display: first(item.label_display, item.display_label, item.final_display_for_packer) ?? null,
    display_for_packer: first(item.display_for_packer, item.packer_copy_text) ?? null,
    quantity: asNumber(first(item.quantity, item.qty, item.extracted_qty, item.total_qty), 1),
    unit_price: Number.isFinite(Number(first(item.unit_price, item.total))) ? Number(first(item.unit_price, item.total)) : null,
    emoji: item.emoji ?? null,
  }));
  const sku = first(r.sku, r.canonical_sku);
  const name = first(r.th_name, r.product_name, r.display_label, r.display_for_packer, r.final_display_for_packer);
  return sku || name ? [{ sku: sku ?? null, th_name: name ?? null, label_display: first(r.label_display, r.display_label) ?? null, display_for_packer: r.display_for_packer ?? r.final_display_for_packer ?? null, quantity: asNumber(first(r.quantity, r.qty, r.extracted_qty), 1), unit_price: Number.isFinite(Number(r.unit_price)) ? Number(r.unit_price) : null, emoji: r.emoji ?? null }] : [];
}

for (const item of $input.all()) {
  const r = item.json ?? {};
  if (!hasCod(r)) continue;
  const items_json = normalizeItems(r);
  const pageId = first(r.page_id, r.Page_ID, r.pageId) ?? null;
  const threadId = first(r.thread_id, r.threadId, r.conversation_key, r.conversation_id) ?? null;
  const sourceMessageId = first(r.source_message_id, r.message_id, r.page_summary_message_id) ?? null;
  const explicitOrderId = first(r.order_number, r.source_order_id, r.order_id);
  const orderFingerprint = [
    pageId ?? "",
    threadId ?? "",
    first(r.order_time, r.order_date, r.timestamp, r.created_at) ?? "",
    first(r.phone, r.extracted_phone, r.customer_id) ?? "",
    first(r.single_cleaned_block, r.final_display_for_packer, r.items_text) ?? "",
  ].join("|");
  const upsertKey = first(
    r.upsert_key,
    explicitOrderId ? `order:${explicitOrderId}` : null,
    sourceMessageId ? `meta:${pageId ?? ""}:${threadId ?? ""}:${sourceMessageId}` : null,
    orderFingerprint.replace(/\|/g, "") ? `order-fp:${stableHash(orderFingerprint)}` : null,
  ) ?? null;
  const items_text = items_json.map(x => `${x.label_display ?? x.display_for_packer ?? x.th_name ?? x.sku ?? "สินค้า"} ${x.quantity} ชิ้น`).join("\n");
  const total_quantity = items_json.reduce((sum, x) => sum + asNumber(x.quantity, 1), 0);
  out.push({ json: {
    ...r,
    upsert_key: upsertKey,
    page_id: pageId,
    thread_id: threadId,
    items_json,
    items_text,
    items_count: items_json.length,
    total_quantity,
    packer_copy_text: first(r.packer_copy_text, items_text) ?? null,
    source_system: r.source_system ?? "front_house",
  } });
}
return out;

// Supabase HTTP Request body: ={{$json}}
// URL: /rest/v1/bb_orders?on_conflict=upsert_key
// Prefer: resolution=merge-duplicates,return=minimal
