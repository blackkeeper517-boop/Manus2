-- FIX: chat_customer_evidence_v2 มีอยู่เป็น TABLE ไม่ใช่ VIEW
-- ห้าม DROP/RENAME ตารางเดิม เพราะอาจมีข้อมูลประวัติอยู่
-- ใช้ view ชื่อใหม่สำหรับหน้าค้นประวัติแทน

create or replace view public.vw_chat_customer_evidence_history as
select
  e.*,
  coalesce(
    e.raw_payload->>'order_number',
    e.raw_payload->>'upsert_key',
    e.raw_payload->'payload'->>'order_number',
    e.raw_payload->'p_payload'->>'order_number'
  ) as extracted_order_number,
  coalesce(
    e.raw_payload->'items_json',
    e.raw_payload->'products',
    e.raw_payload->'detected_products',
    e.raw_payload->'payload'->'items_json',
    e.raw_payload->'payload'->'products',
    e.raw_payload->'p_payload'->'items_json',
    '[]'::jsonb
  ) as extracted_items_json,
  concat_ws(' ',
    e.message_text,
    e.customer_name,
    e.page_name,
    e.raw_payload->>'order_number',
    e.raw_payload->>'phone_clean',
    e.raw_payload->>'phone',
    e.raw_payload->>'display_for_packer',
    e.raw_payload->>'items_text'
  ) as search_text
from public.chat_customer_evidence_v2 e;

comment on view public.vw_chat_customer_evidence_history is
  'History/search projection over existing chat_customer_evidence_v2 table; preserves raw payload and extracts order/items fields.';
