// n8n Code node: 💬 CUSTOMER_CHAT_PROCESSOR
// Mode: Run Once for All Items
// Input: 🌌 HERMES_CHAT_RAW_ALL
// Output: chat_customer_messages

const output = [];
const seen = new Set();

for (const item of $input.all()) {
  const r = item.json ?? {};

  const pageId = String(r.page_id ?? r.Page_ID ?? r.pageId ?? "");
  const conversationKey = String(
    r.conversation_key ??
    r.conversation_id ??
    r.thread_id ??
    r.threadId ??
    ""
  );

  const from = r.message_from ?? r.from ?? {};
  const fromId = String(
    r.message_from_id ??
    r.sender_id ??
    from.id ??
    ""
  );

  // A customer row must identify its sender. If Meta/n8n dropped `from.id`,
  // do not turn a page/system greeting into a fake customer message.
  if (!fromId) continue;

  const messageId = String(
    r.source_message_id ??
    r.message_id ??
    ""
  );

  const text = String(
    r.message_text ??
    r.message ??
    r.text ??
    ""
  );

  // ตัดเฉพาะข้อความที่ระบุชัดเจนว่าเป็นข้อความจากเพจ
  if (
    r.speaker === "page" ||
    r.is_echo === true ||
    r.message_is_echo === true ||
    (pageId && fromId && pageId === fromId)
  ) {
    continue;
  }

  const occurredAt =
    r.occurred_at ??
    r.message_created_time ??
    r.created_time ??
    r.time ??
    null;

  const dedupeKey = String(
    r.dedupe_key ||
    (
      messageId
        ? `meta:${pageId}:${conversationKey}:${messageId}`
        : `meta:${pageId}:${conversationKey}:${occurredAt ?? ""}:${text}`
    )
  );

  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  output.push({
    json: {
      source_message_id: messageId || null,
      dedupe_key: dedupeKey,
      page_id: pageId || null,
      page_name: r.page_name ?? r.Page_Name ?? r.pageName ?? null,
      conversation_key: conversationKey || null,
      customer_id: fromId || null,
      customer_name:
        r.message_from_name ??
        r.sender_name ??
        from.name ??
        null,
      speaker_type: "customer",
      side: "left",
      storage_table: "chat_customer_messages",
      message_text: text,
      message_type: r.message_type ?? "text",
      occurred_at: occurredAt,
      synced_at: new Date().toISOString(),
      media_status: Array.isArray(r.image_urls) && r.image_urls.length ? "pending" : "not_required",
      permanent_image_urls: []
    }
  });
}

return output;

// Supabase destination: chat_customer_messages
// HTTP Upsert conflict column: dedupe_key
