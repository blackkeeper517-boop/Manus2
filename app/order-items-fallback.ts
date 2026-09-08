export type OrderItemFallback = Record<string, unknown>;

function parseJsonArray(value: unknown): OrderItemFallback[] {
  if (Array.isArray(value)) return value.filter((item): item is OrderItemFallback => Boolean(item && typeof item === "object"));
  if (typeof value !== "string" || !value.trim()) return [];
  try { return parseJsonArray(JSON.parse(value)); } catch { return []; }
}

function candidateItems(source: Record<string, unknown>): OrderItemFallback[] {
  const payloads = [source.payload, source.p_payload, source.raw_payload].flatMap(value => value && typeof value === "object" ? [value as Record<string, unknown>] : []);
  const candidates = [source.items_json, source.items, source.products, source.detected_products, source.products_all_fields, ...payloads.flatMap(payload => [payload.items_json, payload.items, payload.products, payload.detected_products, payload.products_all_fields])];
  for (const candidate of candidates) {
    const items = parseJsonArray(candidate);
    if (items.length) return items;
  }
  const display = [source.display_for_packer, source.packer_copy_text, source.items_text].find(value => typeof value === "string" && value.trim());
  return display ? [{ display_for_packer: display, label_display: display, quantity: 1, fallback_source: "display_for_packer" }] : [];
}

export function getOrderItems(order: unknown): OrderItemFallback[] {
  return order && typeof order === "object" ? candidateItems(order as Record<string, unknown>) : [];
}

export function itemDisplay(item: OrderItemFallback) {
  return String(item.telegram_final_mapped ?? item.label_display ?? item.display_for_packer ?? item.th_name ?? item.product_name ?? item.sku ?? "สินค้า");
}

export function orderItemsSource(order: unknown) {
  const items = getOrderItems(order);
  return items.length ? String(items[0].fallback_source ?? "items_json_or_payload") : "none";
}
