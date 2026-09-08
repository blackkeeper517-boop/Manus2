// n8n Code node: BB_ORDERS_CANONICAL_PAYLOAD
// Mode: Run Once for All Items. Place before Supabase upsert to bb_orders.
// หลักการ: ไม่ปล่อย items_json เป็น [] ถ้ายังมีสินค้าอยู่ใน payload สำรอง
const out = [];
function asNumber(value, fallback = 1) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function first(...values) { return values.find(v => v !== undefined && v !== null && String(v).trim() !== ""); }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}
function normalizeOne(item) {
  const x = object(item);
  return {
    sku: first(x.sku, x.SKU, x.canonical_sku) ?? null,
    th_name: first(x.th_name, x.product_name, x.name) ?? null,
    label_display: first(x.label_display, x.display_label, x.final_display_for_packer) ?? null,
    display_for_packer: first(x.display_for_packer, x.packer_copy_text) ?? null,
    quantity: asNumber(first(x.quantity, x.qty, x.extracted_qty, x.requested_qty), 1),
    unit_price: Number.isFinite(Number(x.unit_price)) ? Number(x.unit_price) : null,
    total: Number.isFinite(Number(x.total)) ? Number(x.total) : null,
    emoji: x.emoji ?? null,
    raw_line: x.raw_line ?? null,
  };
}
function normalizeItems(r) {
  const payloads = [r.payload, r.p_payload, r.raw_payload].map(object).filter(x => Object.keys(x).length);
  const candidates = [
    r.items_json, r.items, r.products, r.detected_products, r.products_all_fields, r.product_lines,
    ...payloads.flatMap(p => [p.items_json, p.items, p.products, p.detected_products, p.products_all_fields, p.product_lines]),
  ];
  for (const candidate of candidates) {
    const list = array(candidate).map(normalizeOne).filter(x => x.sku || x.th_name || x.label_display || x.display_for_packer || x.raw_line);
    if (list.length) return list;
  }
  const sku = first(r.sku, r.canonical_sku);
  const name = first(r.th_name, r.product_name, r.display_label, r.display_for_packer, r.final_display_for_packer);
  return sku || name ? [normalizeOne(r)] : [];
}
for (const item of $input.all()) {
  const r = item.json ?? {};
  const items_json = normalizeItems(r);
  const items_text = items_json.map(x => `${x.label_display ?? x.display_for_packer ?? x.th_name ?? x.sku ?? "สินค้า"} ${x.quantity} ชิ้น`).join("\n");
  out.push({ json: { ...r, items_json, items_text, items_count: items_json.length, total_quantity: items_json.reduce((sum, x) => sum + asNumber(x.quantity, 1), 0), packer_copy_text: first(r.packer_copy_text, items_text) ?? null, items_source: items_json.length ? "payload_fallback_supported" : "none", source_system: r.source_system ?? "front_house" } });
}
return out;
