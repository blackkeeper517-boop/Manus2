-- NIGHTOPS Order Performance: indexes + RPC
-- Run in Supabase SQL Editor.
-- The RPC intentionally returns bb_orders rows only. Product details remain in bb_order_items_fix.

create index if not exists bb_orders_page_thread_created_idx
  on public.bb_orders (page_id, thread_id, created_at desc);

create index if not exists bb_orders_page_id_idx
  on public.bb_orders (page_id);

create index if not exists bb_orders_thread_id_idx
  on public.bb_orders (thread_id);

create or replace function public.get_latest_orders_for_thread(
  p_page_id text,
  p_thread_id text,
  p_limit integer default 20
)
returns setof public.bb_orders
language sql
stable
security invoker
set search_path = public
as $$
  select o.*
  from public.bb_orders as o
  where o.page_id::text = p_page_id
    and o.thread_id::text = p_thread_id
  order by o.created_at desc nulls last
  limit greatest(least(coalesce(p_limit, 20), 100), 1);
$$;

-- Keep the RPC callable only by the server role.
revoke all on function public.get_latest_orders_for_thread(text, text, integer) from public, anon, authenticated;
grant execute on function public.get_latest_orders_for_thread(text, text, integer) to service_role;
