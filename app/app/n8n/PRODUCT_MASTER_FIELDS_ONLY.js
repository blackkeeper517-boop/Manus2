// n8n Code node: 🧱 PRODUCT_MASTER_FIELDS_ONLY
// Run Once for All Items
// Purpose: write only canonical product fields to product_map_master.
// Order/Telegram fields intentionally stay out of this table.

const PRODUCT_FIELDS = [
  "map_id", "sku", "product_name", "th_name", "alias", "alias_text", "alias_norm",
  "products", "unit_price", "emoji", "emoji_master", "display_for_packer",
  "final_display_for_packer", "telegram_final_mapped", "telegram_final_map",
  "telegram_final_mapตอนไหน", "quantity", "qty", "extracted_qty", "source", "source_room",
  "active", "lock_status", "validate_rpc_body", "updated_at"
];

return $input.all().map(item => {
  const source = item.json ?? {};
  const product = {};
  for (const field of PRODUCT_FIELDS) {
    if (source[field] !== undefined) product[field] = source[field];
  }
  // Canonical fallbacks: use stable SKU and Thai name, never an order address/name.
  if (product.sku == null && source.product_sku != null) product.sku = source.product_sku;
  if (product.th_name == null && source.product_name_th != null) product.th_name = source.product_name_th;
  if (product.display_for_packer == null && source.label_display != null) product.display_for_packer = source.label_display;
  return { json: product };
});
