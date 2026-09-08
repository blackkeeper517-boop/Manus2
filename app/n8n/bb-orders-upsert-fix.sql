-- NIGHTOPS fix for Supabase REST upsert
-- n8n URL uses: /rest/v1/bb_orders?on_conflict=upsert_key
-- PostgreSQL must have a UNIQUE constraint/index on upsert_key.

-- 1) Inspect duplicates first. This query does not modify data.
select upsert_key, count(*) as row_count
from public.bb_orders
where upsert_key is not null
  and btrim(upsert_key) <> ''
group by upsert_key
having count(*) > 1
order by row_count desc, upsert_key;

-- 2) Create the unique index required by PostgREST ON CONFLICT.
-- If step 1 returns rows, resolve those duplicates first, then run this step.
create unique index if not exists bb_orders_upsert_key_unique_idx
  on public.bb_orders (upsert_key);

comment on index public.bb_orders_upsert_key_unique_idx is
  'Required for Supabase REST upsert with on_conflict=upsert_key';

-- 3) Verification: should return one row with indexname above.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'bb_orders'
  and indexname = 'bb_orders_upsert_key_unique_idx';

-- n8n HTTP Request settings:
-- Method: POST (or PATCH/upsert operation)
-- URL: /rest/v1/bb_orders?on_conflict=upsert_key
-- Header: Prefer = resolution=merge-duplicates,return=minimal
-- Body: output from BB_ORDERS_CANONICAL_PAYLOAD
