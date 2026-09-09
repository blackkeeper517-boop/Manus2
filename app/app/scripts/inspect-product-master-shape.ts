const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) throw new Error("Supabase secrets are not configured");
const response = await fetch(`${baseUrl}/rest/v1/product_master?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!response.ok) throw new Error(`product_master HTTP ${response.status}`);
const rows = await response.json() as Record<string, unknown>[];
const row = rows[0] ?? {};
console.log(JSON.stringify({ rowCountReturned: rows.length, fields: Object.fromEntries(Object.entries(row).map(([name, value]) => [name, Array.isArray(value) ? "array" : value === null ? "null" : typeof value])) }));
