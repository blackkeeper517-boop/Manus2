const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) throw new Error("Supabase secrets are missing");

async function rows(table: string) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=customer_name,facebook_name,phone,full_address,addressclean,page_name,thread_id,threadId,order_number,upsert_key&limit=1000`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) throw new Error(`${table} returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>[]>;
}

function filled(values: Record<string, unknown>[], key: string) {
  return values.filter(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "").length;
}

for (const table of ["bb_order", "bb_order_items_fix"]) {
  const values = await rows(table);
  console.log(JSON.stringify({ table, rows: values.length, customer_name: filled(values, "customer_name"), facebook_name: filled(values, "facebook_name"), phone: filled(values, "phone"), full_address: filled(values, "full_address"), addressclean: filled(values, "addressclean"), page_name: filled(values, "page_name"), thread_id: filled(values, "thread_id"), threadId: filled(values, "threadId"), order_number: filled(values, "order_number"), upsert_key: filled(values, "upsert_key") }));
}
