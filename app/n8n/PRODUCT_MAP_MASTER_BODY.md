# `product_map_master` exact payload

The live table contains these relevant columns: `map_id`, `upsert_key`, `order_number`, `order_time`, `message_id`, `page_id`, `page_name`, `source`, `source_room`, `sku`, `product_name`, `th_name`, `alias`, `alias_text`, `alias_norm`, `products`, `quantity`, `qty`, `extracted_qty`, `unit_price`, `emoji`, `emoji_master`, `extracted_emoji`, `display_for_packer`, `final_display_for_packer`, `telegram_final_mapped`, `telegram_final_map`, `telegram_final_mapตอนไหน`, `clean_text`, `single_cleaned_block`, `lock_status`, `active`, `validate_rpc_body`, `created_at`, and `updated_at`.

Use this n8n HTTP Request JSON Body. It deliberately excludes address, customer, phone, and Telegram delivery fields:

```text
={{ JSON.stringify({
  alias_text: String($json.extracted_product_block || $json.alias || $json.product_name || '').trim(),
  alias_norm: String($json.extracted_product_block || $json.alias || $json.product_name || '').trim().toLowerCase(),
  alias: String($json.alias || '').trim() || null,
  sku: String($json.sku || 'DATA_MISSING').trim(),
  source: 'front_house',
  source_room: 'front_house',
  upsert_key: $json.upsert_key || null,
  order_number: $json.order_number || null,
  order_time: $json.order_time || null,
  message_id: $json.message_id || null,
  page_id: $json.page_id || null,
  page_name: $json.page_name || null,
  th_name: $json.th_name || null,
  product_name: $json.product_name || null,
  display_for_packer: $json.display_for_packer || null,
  final_display_for_packer: $json.final_display_for_packer || null,
  telegram_final_mapped: $json.telegram_final_mapped || null,
  telegram_final_map: $json.telegram_final_map || null,
  qty: Number($json.qty ?? 1),
  quantity: Number($json.quantity ?? $json.qty ?? 1),
  extracted_qty: Number($json.extracted_qty ?? $json.qty ?? 1),
  unit_price: $json.unit_price == null ? null : Number($json.unit_price),
  emoji: $json.emoji || null,
  emoji_master: $json.emoji_master || null,
  extracted_emoji: $json.extracted_emoji || null,
  lock_status: $json.lock_status || '',
  active: $json.active ?? true,
  created_at: $json.created_at || new Date().toISOString(),
  updated_at: new Date().toISOString()
}) }}
```

## Do not send these fields to `product_map_master`

`address_display_packer`, `full_address`, `addressclean`, `customer_name`, `facebook_name`, `phone`, `telegram_message`, `telegram_copy_text`, `packer_copy_text`, `telegram_chat_id`, and `telegram_body` belong to the order/delivery branch.

## Preserve all 150 orders

Use a separate branch after the parser:

```text
front-house parser
  ├─> order payload -> bb_order / bb_order_items_fix (required path)
  └─> IF product text exists -> product payload -> product_map_master (best effort)
                                      └─> warning if missing/ambiguous
```

The product branch must not be placed in series before the order insert. Configure the product HTTP Request with `Continue On Fail` or route its error output to the warning branch. If product text is empty, return `[]` from the product branch; do not insert `DATA_MISSING` as a fake product. The order branch must retain all 150 input items and use its own deduplication key.
