-- BB ORDERS ITEMS FALLBACK
-- ใช้กับ public.bb_orders หลังตรวจว่าคอลัมน์ telegram_body และ display_for_packer มีอยู่แล้ว
-- ไม่ลบ/ไม่เขียนทับ items_json ที่มีข้อมูลอยู่แล้ว

create or replace function public.bb_orders_fill_items_json_fallback()
returns trigger
language plpgsql
as $$
declare
  candidate jsonb := '[]'::jsonb;
  item_count integer := 0;
begin
  -- primary: ค่าที่ n8n ส่งมาโดยตรง
  if new.items_json is not null and jsonb_typeof(new.items_json) = 'array' and jsonb_array_length(new.items_json) > 0 then
    return new;
  end if;

  -- fallback 1: telegram_body.items_json / products / detected_products
  if new.telegram_body is not null and jsonb_typeof(new.telegram_body) = 'object' then
    candidate := coalesce(
      case when jsonb_typeof(new.telegram_body->'items_json') = 'array' then new.telegram_body->'items_json' end,
      case when jsonb_typeof(new.telegram_body->'products') = 'array' then new.telegram_body->'products' end,
      case when jsonb_typeof(new.telegram_body->'detected_products') = 'array' then new.telegram_body->'detected_products' end,
      '[]'::jsonb
    );
  end if;

  -- fallback 2: legacy single product columns already present in bb_orders
  if jsonb_array_length(candidate) = 0 and (
    new.sku is not null or new.th_name is not null or new.display_label is not null or new.display_for_packer is not null
  ) then
    candidate := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'sku', new.sku,
      'th_name', new.th_name,
      'label_display', coalesce(new.display_label, new.display_for_packer),
      'display_for_packer', new.display_for_packer,
      'quantity', 1,
      'unit_price', null,
      'fallback_source', 'bb_orders_legacy_columns'
    )));
  end if;

  item_count := jsonb_array_length(candidate);
  if item_count > 0 then
    new.items_json := candidate;
    new.items_count := item_count;
    new.total_quantity := coalesce((
      select sum(case when coalesce(x->>'quantity', '') ~ '^[0-9]+(\\.[0-9]+)?$' then (x->>'quantity')::numeric else 1 end)
      from jsonb_array_elements(candidate) as x
    ), item_count);
    new.items_text := (
      select string_agg(coalesce(x->>'label_display', x->>'display_for_packer', x->>'th_name', x->>'sku', 'สินค้า') || ' ' || coalesce(x->>'quantity', '1') || ' ชิ้น', E'\\n')
      from jsonb_array_elements(candidate) as x
    );
    new.packer_copy_text := coalesce(new.packer_copy_text, new.items_text);
  end if;

  return new;
end;
$$;

drop trigger if exists bb_orders_fill_items_json_fallback on public.bb_orders;
create trigger bb_orders_fill_items_json_fallback
before insert or update of items_json, telegram_body, sku, th_name, display_label, display_for_packer
on public.bb_orders
for each row execute function public.bb_orders_fill_items_json_fallback();

-- ตรวจสอบรายการที่ยังว่างหลังติดตั้ง trigger
comment on function public.bb_orders_fill_items_json_fallback() is
  'Fills empty bb_orders.items_json from telegram_body payload or legacy product columns without overwriting non-empty items';
