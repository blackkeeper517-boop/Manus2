// n8n Code node: 🖼️ HERMES_MEDIA_PATCH_BUILD
// Input: item from HERMES_MEDIA_PREPARE plus binary.data from the upload step.
// Configure the previous HTTP upload node to keep the JSON input and return its response.
// Output: one REST PATCH request descriptor per stored image.

const output = [];
for (const item of $input.all()) {
  const row = item.json ?? {};
  const publicBase = String($env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const bucket = "chat-media";
  const permanentUrl = `${publicBase}/storage/v1/object/public/${bucket}/${row.storage_key}`;
  const table = row.storage_table === "chat_page_messages" ? "chat_page_messages" : "chat_customer_messages";
  output.push({ json: {
    table,
    dedupe_key: row.dedupe_key,
    patch_url: `${publicBase}/rest/v1/${table}?dedupe_key=eq.${encodeURIComponent(row.dedupe_key)}`,
    patch_body: {
      permanent_image_urls: [permanentUrl],
      media_status: "stored",
      media_error: null,
      media_synced_at: new Date().toISOString(),
    },
    permanent_url: permanentUrl,
  } });
}
return output;
