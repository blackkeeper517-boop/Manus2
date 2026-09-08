// n8n Code node: 🌿 PRODUCT_MASTER_BRANCH_PREPARE
// Run Once for All Items
// Place on a side branch after the front-house parser, never before bb_order.
// Empty/unmapped product text returns [] so the order branch still receives every order.

const output = [];
const seen = new Set();
for (const item of $input.all()) {
  const r = item.json ?? {};
  const productText = String(r.extracted_product_block || r.product_text || r.product_name || r.alias || '').trim();
  if (!productText) continue;
  const key = String(r.upsert_key || `${r.sku || 'DATA_MISSING'}:${productText.toLowerCase()}`);
  if (seen.has(key)) continue;
  seen.add(key);
  output.push({ json: {
    alias_text: productText,
    alias_norm: productText.toLowerCase(),
    alias: String(r.alias || '').trim() || null,
    sku: String(r.sku || 'DATA_MISSING').trim(),
    source: 'front_house',
    source_room: 'front_house',
    upsert_key: r.upsert_key ?? null,
    order_number: r.order_number ?? null,
    order_time: r.order_time ?? null,
    message_id: r.message_id ?? null,
    page_id: r.page_id ?? null,
    page_name: r.page_name ?? null,
    th_name: r.th_name ?? null,
    product_name: r.product_name ?? null,
    display_for_packer: r.display_for_packer ?? null,
    final_display_for_packer: r.final_display_for_packer ?? null,
    telegram_final_mapped: r.telegram_final_mapped ?? null,
    qty: Number(r.qty ?? 1), quantity: Number(r.quantity ?? r.qty ?? 1), extracted_qty: Number(r.extracted_qty ?? r.qty ?? 1),
    unit_price: r.unit_price == null ? null : Number(r.unit_price), emoji: r.emoji ?? null, emoji_master: r.emoji_master ?? null,
    extracted_emoji: r.extracted_emoji ?? null, lock_status: r.lock_status ?? '', active: r.active ?? true,
    created_at: r.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString()
  } });
}
return output;
