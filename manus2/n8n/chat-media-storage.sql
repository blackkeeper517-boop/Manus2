-- NIGHTOPS permanent Meta media storage
-- Run after n8n/chat-tables.sql.
-- The bucket is public so Chat Hub can render stable URLs without Meta URL expiry.
-- Keep the bucket limited to media downloaded by the server-side n8n workflow.

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = excluded.public;

alter table public.chat_customer_messages
  add column if not exists media_status text not null default 'not_required'
    check (media_status in ('not_required','pending','stored','failed')),
  add column if not exists permanent_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists media_error text,
  add column if not exists media_synced_at timestamptz;

alter table public.chat_page_messages
  add column if not exists media_status text not null default 'not_required'
    check (media_status in ('not_required','pending','stored','failed')),
  add column if not exists permanent_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists media_error text,
  add column if not exists media_synced_at timestamptz;

create index if not exists chat_customer_messages_media_idx
  on public.chat_customer_messages (media_status, synced_at desc);
create index if not exists chat_page_messages_media_idx
  on public.chat_page_messages (media_status, synced_at desc);

-- The n8n service-role workflow writes these columns through REST.
-- Do not grant anon/browser write access to storage.objects or the chat tables.
-- If your Supabase project already enforces storage policies, keep them restrictive
-- and let the service role bypass them.
