-- CUSTOMER CHAT EVIDENCE V2
-- ห้องประวัติสำหรับค้นข้อความฝั่งลูกค้า/เพจและหาออเดอร์จาก raw_payload
-- ไม่ลบหรือแก้ข้อมูลต้นฉบับใน chat_customer_evidence

create or replace view public.chat_customer_evidence_v2 as
select
  e.id,
  e.source_message_id,
  e.dedupe_key,
  e.page_id,
  e.page_name,
  e.conversation_key,
  e.customer_id,
  e.customer_name,
  e.sender_id,
  e.sender_name,
  e.speaker_type,
  e.message_text,
  e.message_type,
  e.attachments_json,
  e.image_urls,
  e.has_image,
  e.attachment_count,
  e.occurred_at,
  e.source_created_at,
  e.first_seen_at,
  e.last_seen_at,
  e.raw_payload,
  coalesce(
    e.raw_payload->>'order_number',
    e.raw_payload->>'upsert_key',
    e.raw_payload->'payload'->>'order_number',
    e.raw_payload->'p_payload'->>'order_number'
  ) as order_number,
  coalesce(
    e.raw_payload->'items_json',
    e.raw_payload->'products',
    e.raw_payload->'detected_products',
    e.raw_payload->'payload'->'items_json',
    e.raw_payload->'payload'->'products',
    e.raw_payload->'p_payload'->'items_json',
    '[]'::jsonb
  ) as items_json,
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
from public.chat_customer_evidence e;

create index if not exists chat_customer_evidence_raw_payload_gin_idx
  on public.chat_customer_evidence using gin (raw_payload);

comment on view public.chat_customer_evidence_v2 is
  'Search/history projection over customer evidence. Keeps raw_payload and extracts order_number/items_json without changing source rows.';
