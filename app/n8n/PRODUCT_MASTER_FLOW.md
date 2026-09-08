# Product Master flow

Use this order:

```text
order parser
  ├─> PRODUCT_MASTER_FIELDS_ONLY -> product_map_master
  ├─> STOCK_WARNING_NODE -> low/out-of-stock alert branch
  └─> PRODUCT_MAPPING_WARNING_NODE -> unmapped/ambiguous review branch
```

## Product Master boundary

`product_map_master` should contain only product identity and mapping fields: `sku`, `product_name`, `th_name`, `alias`, `alias_text`, `alias_norm`, `display_for_packer`, `unit_price`, emoji fields, quantities, mapping status, source, and lock/active metadata.

Do not send these order-level fields to Product Master:

- `address_display_packer`, `full_address`, customer name, phone;
- `telegram_message`, `telegram_copy_text`, `packer_copy_text`;
- `telegram_chat_id` or `telegram_body`.

Those fields belong to the order/output branch. If a Telegram or packer message is generated, keep it on the `bb_order`/`bb_order_items_fix` branch or a dedicated delivery-log table. If the same workflow needs both shapes, use separate Code nodes and separate HTTP Request nodes; never pass the full order object directly into Product Master.

The two warning nodes intentionally return `[]` when there is no warning, so configure downstream n8n branches to tolerate empty output or enable Always Output Data only where the branch requires it.
