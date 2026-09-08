-- NIGHTOPS order history support for bb_orders
-- Run once in Supabase SQL Editor.
-- This keeps order history separate from chat tables while preserving the
-- shared lookup key: page_id + thread_id.

alter table public.bb_orders
  add column if not exists raw_text text,
  add column if not exists raw_text_with_phone text,
  add column if not exists raw_text_with_phone_timed text,
  add column if not exists full_chunk_text text,
  add column if not exists chat_timeline jsonb not null default '[]'::jsonb,
  add column if not exists final_display_for_packer text,
  add column if not exists extracted_phone text,
  add column if not exists addressclean text,
  add column if not exists short_address text,
  add column if not exists single_cleaned_block text,
  add column if not exists bubble_window integer,
  add column if not exists short_address text,
  add column if not exists single_cleaned_block text,
  add column if not exists bubble_window integer,
  add column if not exists qty numeric,
  add column if not exists telegram_sent boolean not null default false,
  add column if not exists has_phone boolean not null default false,
  add column if not exists has_phone boolean not null default false,
  add column if not exists has_cod boolean not null default false,
  add column if not exists raw_payload jsonb;

create index if not exists bb_orders_history_date_idx
  on public.bb_orders (order_date, created_at desc);
create index if not exists bb_orders_history_page_thread_idx
  on public.bb_orders (page_id, thread_id, order_time desc);
create index if not exists bb_orders_history_phone_idx
  on public.bb_orders (phone);

comment on column public.bb_orders.chat_timeline is
  'Order parser timeline snapshot; chat remains in chat_customer_messages/chat_page_messages';
comment on column public.bb_orders.raw_text_with_phone is
  'Parser evidence snapshot used by order history, not a chat transcript source';
comment on column public.bb_orders.raw_text_with_phone_timed is
  'Timestamped parser evidence snapshot for order audit';
comment on column public.bb_orders.page_id is
  'Shared link key to chat page projection';
comment on column public.bb_orders.thread_id is
  'Shared link key to chat conversation';

-- Recommended n8n upsert identity:
-- Prefer upsert_key/order_number for order identity.
-- Always carry page_id and thread_id when available.
-- Do not write order parser rows into chat_customer_evidence.
