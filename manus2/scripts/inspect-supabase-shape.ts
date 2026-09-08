const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) throw new Error("Supabase secrets are missing");

async function inspect(table: string) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`${table} returned HTTP ${response.status}`);
  const rows = await response.json() as Record<string, unknown>[];
  const row = rows[0] ?? {};
  const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Array.isArray(value) ? "array" : value === null ? "null" : typeof value]));
  console.log(JSON.stringify({ table, rowCountReturned: rows.length, fields }));
}

await inspect("bb_order");
await inspect("bb_order_items_fix");
