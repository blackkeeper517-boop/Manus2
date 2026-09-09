// n8n Code node: BB_ORDER_ITEMS_PAYLOAD
// Run after BB_ORDERS_CANONICAL_PAYLOAD and before the Supabase bb_order_items upsert.
// It emits one item per product line, so no JSON column is required.

function first(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}
function asNumber(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function hasCod(r) {
  const value = first(r.cod_amount, r.expected_cod, r.total_cod, r.calculated_cod);
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric > 0 : true;
}
function normalizeItems(r) {
  const source = r.items ?? r.products ?? r.product_lines ?? r.products_all_fields ?? r.items_json ?? [];
  if (Array.isArray(source) && source.length) return source;
  const sku = first(r.sku, r.canonical_sku);
  const name = first(r.th_name, r.product_name, r.display_label, r.display_for_packer, r.final_display_for_packer);
  return sku || name ? [r] : [];
}

const out = [];
for (const input of $input.all()) {
  const r = input.json ?? {};
  if (!hasCod(r)) continue;
  const orderKey = first(r.upsert_key, r.order_number, r.id ? `id:${r.id}` : null);
  if (!orderKey) continue;
  normalizeItems(r).forEach((item, index) => {
    out.push({ json: {
      order_key: String(orderKey),
      order_number: first(r.order_number, item.order_number) ?? null,
      line_no: index + 1,
      sku: first(item.sku, item.SKU, item.canonical_sku) ?? null,
      th_name: first(item.th_name, item.product_name, item.name) ?? null,
      label_display: first(item.label_display, item.display_label, item.final_display_for_packer) ?? null,
      display_for_packer: first(item.display_for_packer, item.packer_copy_text) ?? null,
      emoji: item.emoji ?? null,
      quantity: asNumber(first(item.quantity, item.qty, item.extracted_qty, item.total_qty), 1),
      unit_price: Number.isFinite(Number(first(item.unit_price, item.total))) ? Number(first(item.unit_price, item.total)) : null,
      updated_at: new Date().toISOString(),
    } });
  });
}
return out;

// Supabase HTTP Request:
// POST /rest/v1/bb_order_items?on_conflict=order_key,line_no
// Prefer: resolution=merge-duplicates,return=minimal
// Body: ={{$json}}
