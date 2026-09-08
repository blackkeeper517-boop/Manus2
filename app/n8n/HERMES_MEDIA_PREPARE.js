// n8n Code node: 🖼️ HERMES_MEDIA_PREPARE
// Mode: Run Once for All Items
// Place after each chat processor and before its Supabase upsert.
// It emits one item per external image URL. Empty/no-image rows return [].

const output = [];
const seen = new Set();

function urlsFrom(row) {
  const values = [];
  const add = value => {
    if (typeof value === "string" && /^https?:\/\//i.test(value) && !values.includes(value)) values.push(value);
  };
  const walk = value => {
    if (!value) return;
    if (typeof value === "string") return add(value);
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== "object") return;
    const record = value;
    add(record.url);
    add(record.file_url);
    add(record.fileUrl);
    if (record.payload && typeof record.payload === "object") add(record.payload.url);
    Object.values(record).forEach(child => {
      if (Array.isArray(child) || (child && typeof child === "object")) walk(child);
    });
  };
  walk(row.permanent_image_urls);
  if (!values.length) walk(row.image_urls);
  if (!values.length) walk(row.attachments_json ?? row.attachments);
  return values;
}

for (const item of $input.all()) {
  const row = item.json ?? {};
  const table = row.storage_table ?? (row.speaker_type === "page" ? "chat_page_messages" : "chat_customer_messages");
  const dedupeKey = String(row.dedupe_key ?? "");
  if (!dedupeKey) continue;
  for (const [index, sourceUrl] of urlsFrom(row).entries()) {
    const key = `${dedupeKey}:${index}:${sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const safeMessage = String(row.source_message_id ?? dedupeKey).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
    const extension = /\.png(?:\?|$)/i.test(sourceUrl) ? "png" : /\.gif(?:\?|$)/i.test(sourceUrl) ? "gif" : /\.webp(?:\?|$)/i.test(sourceUrl) ? "webp" : "jpg";
    output.push({ json: {
      storage_table: table,
      dedupe_key: dedupeKey,
      source_message_id: row.source_message_id ?? null,
      page_id: row.page_id ?? null,
      conversation_key: row.conversation_key ?? null,
      source_url: sourceUrl,
      storage_key: `meta/${String(row.page_id ?? "unknown")}/${safeMessage}_${index}.${extension}`,
      media_index: index,
      original_row: row,
    } });
  }
}

return output;
