// n8n Code node: 🧹 PRODUCT_MAP_MASTER_SANITIZER
// Mode: Run Once for All Items
// Use immediately before the HTTP Request that upserts product_map_master.
// product_map_master is a product-mapping table, not an order table.

const allowed = [
  "map_id", "upsert_key", "order_number", "order_time", "message_id", "page_id", "page_name",
  "source", "source_room", "sku", "product_name", "th_name", "alias", "alias_text", "alias_norm",
  "products", "quantity", "qty", "extracted_qty", "unit_price", "cod_amount", "expected_cod",
  "item_expected_cod", "emoji", "emoji_master", "extracted_emoji", "display_for_packer",
  "final_display_for_packer", "telegram_final_mapped", "telegram_final_map", "telegram_final_mapตอนไหน",
  "clean_text", "single_cleaned_block", "lock_status", "active", "validate_rpc_body", "created_at", "updated_at"
];

const out = [];
for (const item of $input.all()) {
  const source = item.json ?? {};
  const row = {};
  for (const key of allowed) {
    if (source[key] !== undefined) row[key] = source[key];
  }
  // Never send order-address/customer fields to product_map_master.
  delete row.address_display_packer;
  delete row.full_address;
  delete row.addressclean;
  delete row.address_line_1;
  delete row.address_line_2;
  delete row.customer_name;
  delete row.facebook_name;
  delete row.phone;
  out.push({ json: row });
}
return out;
