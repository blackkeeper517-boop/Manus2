// n8n Code node: 🟣 PAGE_CHAT_PROCESSOR
// Mode: Run Once for All Items
// Input: 🌌 HERMES_CHAT_RAW_ALL
// Output: one item per page-authored message for chat_page_messages.

const output = [];
const seen = new Set();

for (const item of $input.all()) {
  const row = item.json ?? {};
  const isMessage = row.record_type === "message"
    || Boolean(row.message_id || row.source_message_id || row.message_text || row.message || (Array.isArray(row.attachments) && row.attachments.length) || (Array.isArray(row.image_urls) && row.image_urls.length));
  if (!isMessage) continue;

  const pageId = String(row.page_id ?? row.Page_ID ?? row.pageId ?? "");
  const from = row.message_from ?? row.from ?? {};
  const fromId = String(row.message_from_id ?? row.sender_id ?? from.id ?? "");
  const fromName = String(row.message_from_name ?? row.sender_name ?? from.name ?? "");
  const pageName = String(row.page_name ?? row.Page_Name ?? row.pageName ?? "");

  const isPage = row.speaker === "page"
    || row.speaker_hint === "page"
    || row.message_from_is_page === true
    || row.message_is_echo === true
    || row.is_echo === true
    || (fromId !== "" && pageId !== "" && fromId === pageId)
    ;
  if (!isPage) continue;

  const conversationKey = String(row.conversation_key ?? row.conversation_id ?? row.thread_id ?? row.threadId ?? "");
  const messageId = String(row.source_message_id ?? row.message_id ?? "");
  const text = row.message_text ?? row.message ?? row.text ?? "";
  const occurredAt = row.occurred_at ?? row.message_created_time ?? row.created_time ?? row.time ?? null;
  const dedupeKey = messageId ? `meta:${messageId}` : String(row.dedupe_key ?? `meta:${pageId}:${conversationKey}:${occurredAt}:${text}`);
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  output.push({ json: {
    source_message_id: messageId || null,
    dedupe_key: dedupeKey,
    page_id: pageId,
    page_name: pageName || null,
    conversation_key: conversationKey,
    page_sender_id: fromId || pageId || null,
    page_sender_name: fromName || pageName || null,
    speaker_type: "page",
    side: "right",
    storage_table: "chat_page_messages",
    message_text: String(text),
    message_type: row.message_type ?? (Array.isArray(row.attachments) && row.attachments.length ? "attachment" : "text"),
    attachments_json: row.attachments_json ?? row.attachments ?? [],
    image_urls: row.image_urls ?? [],
    has_image: row.has_image === true || (Array.isArray(row.image_urls) && row.image_urls.length > 0),
    attachment_count: row.attachment_count ?? (Array.isArray(row.attachments) ? row.attachments.length : 0),
    shares_json: row.shares_json ?? row.shares ?? null,
    sticker_json: row.sticker_json ?? row.sticker ?? null,
    occurred_at: occurredAt,
    source_created_at: row.message_created_time ?? row.created_time ?? null,
    synced_at: row.fetched_at ?? new Date().toISOString(),
    media_status: Array.isArray(row.image_urls) && row.image_urls.length ? "pending" : "not_required",
    permanent_image_urls: [],
    raw_payload: row.raw_payload ?? {
      page_id: pageId,
      conversation_id: row.conversation_id ?? conversationKey,
      message_id: row.message_id ?? messageId,
      message: text,
      from,
      is_echo: row.message_is_echo ?? row.is_echo ?? false,
      attachments: row.attachments ?? [],
      shares: row.shares ?? null,
      sticker: row.sticker ?? null,
    },
  } });
}

return output;

// Supabase destination: chat_page_messages; Upsert conflict: dedupe_key.
