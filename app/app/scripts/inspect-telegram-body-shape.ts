const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) throw new Error("Supabase secrets are not configured");
for (const table of ["bb_order", "bb_order_items_fix"]) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", "id,telegram_body,telegram_message,telegram_copy_text,clean_text,single_cleaned_block,debug_block,debug_prod,parsed_product_raw,alias_text");
  url.searchParams.set("limit", "3");
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`${table} HTTP ${response.status}`);
  const rows = await response.json() as Record<string, unknown>[];
  console.log(JSON.stringify({ table, rows: rows.map(row => ({
    id: row.id,
    bodyKeys: row.telegram_body && typeof row.telegram_body === "object" ? Object.keys(row.telegram_body as object) : [],
    lengths: Object.fromEntries(["telegram_message", "telegram_copy_text", "clean_text", "single_cleaned_block", "debug_block", "debug_prod", "parsed_product_raw", "alias_text"].map(field => [field, String(row[field] ?? "").length])),
  })) }));
}
