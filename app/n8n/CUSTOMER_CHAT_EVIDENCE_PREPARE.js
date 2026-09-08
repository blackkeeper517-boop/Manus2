// n8n Code node: 🧾 CUSTOMER_CHAT_EVIDENCE_PREPARE
// Mode: Run Once for All Items
// Input: 🌌 HERMES_CHAT_RAW_ALL or the normalized chat splitter
// Destination: chat_customer_evidence, Supabase REST Upsert on dedupe_key
// This is chat evidence only; it does not create or replace order evidence.

const output = [];
const seen = new Set();

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function nonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const clean = String(value).trim();
    if (clean && clean !== "null" && clean !== "undefined") return clean;
  }
  return "";
}

// Supabase timestamptz must not receive Thai display strings such as
// 26/08/26 11:18:54. Treat slash-formatted values as Asia/Bangkok, convert
// Buddhist years, and return an unambiguous UTC ISO string.
function normalizeTimestamp(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const input = String(value).trim();
  const slash = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/);
  if (slash) {
    let year = Number(slash[3]);
    if (year > 2400) year -= 543;
    else if (year < 100) year += 2000;
    const local = `${year.toString().padStart(4, "0")}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}T${(slash[4] ?? "00").padStart(2, "0")}:${slash[5] ?? "00"}:${slash[6] ?? "00"}.${(slash[7] ?? "0").padEnd(3, "0")}+07:00`;
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const withColonOffset = input.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(withColonOffset);
  const date = new Date(hasTimezone ? withColonOffset : `${withColonOffset.replace(" ", "T")}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

for (const item of $input.all()) {
  const r = item.json ?? {};
  const raw = r.raw_payload && typeof r.raw_payload === "object" ? r.raw_payload : {};
  const rawConversation = raw.conversation && typeof raw.conversation === "object" ? raw.conversation : {};
  const rawMessage = raw.message && typeof raw.message === "object" ? raw.message : {};
  const pageId = nonEmpty(r.page_id, r.Page_ID, r.pageId, raw.page_id, raw.Page_ID, raw.pageId, rawConversation.page_id, rawConversation.Page_ID, rawMessage.page_id, rawMessage.Page_ID, r.page?.id, raw.page?.id);
  const conversationKey = nonEmpty(r.conversation_key, r.conversation_id, r.thread_id, r.threadId, raw.conversation_key, raw.conversation_id, raw.thread_id, raw.threadId, rawConversation.id, rawConversation.conversation_id);
  const from = r.message_from ?? r.from ?? {};
  const senderId = nonEmpty(r.message_from_id, r.sender_id, from.id, r.customer_id, raw.message_from_id, raw.sender_id, rawMessage.from?.id);
  const sourceMessageId = nonEmpty(r.source_message_id, r.message_id, r.id, raw.source_message_id, raw.message_id, rawMessage.id);
  const text = String(r.message_text ?? r.message ?? r.text ?? "");
  const occurredAt = normalizeTimestamp(r.occurred_at ?? r.message_created_time ?? r.created_time ?? r.time ?? null);
  const attachments = arrayValue(r.attachments_json ?? r.attachments);
  const imageUrls = arrayValue(r.image_urls).map(String).filter(url => /^https?:\/\//i.test(url));

  // Evidence is customer-only and uses explicit sender/page identity.
  if (!pageId || !conversationKey || !senderId) continue;
  if (r.speaker === "page" || r.speaker_type === "page" || r.is_echo === true || r.message_is_echo === true || senderId === pageId) continue;
  if (!sourceMessageId && !text.trim() && attachments.length === 0 && imageUrls.length === 0) continue;

  const dedupeKey = String(r.dedupe_key || (sourceMessageId
    ? `meta:${sourceMessageId}`
    : `meta:${pageId}:${conversationKey}:${occurredAt ?? ""}:${text}:${JSON.stringify(attachments)}`));
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  output.push({ json: {
    source_message_id: sourceMessageId || null,
    dedupe_key: dedupeKey,
    page_id: pageId,
    page_name: r.page_name ?? r.Page_Name ?? r.pageName ?? null,
    conversation_key: conversationKey,
    customer_id: r.customer_id ?? senderId,
    customer_name: r.customer_name ?? r.message_from_name ?? r.sender_name ?? from.name ?? null,
    sender_id: senderId,
    sender_name: r.message_from_name ?? r.sender_name ?? from.name ?? null,
    speaker_type: "customer",
    message_text: text,
    message_type: r.message_type ?? (imageUrls.length || attachments.length ? "attachment" : "text"),
    attachments_json: attachments,
    image_urls: imageUrls,
    has_image: imageUrls.length > 0 || attachments.some(a => /image/i.test(String(a?.mime_type ?? a?.type ?? ""))),
    attachment_count: attachments.length,
    shares_json: r.shares_json ?? r.shares ?? null,
    sticker_json: r.sticker_json ?? r.sticker ?? null,
    occurred_at: occurredAt,
    source_created_at: normalizeTimestamp(r.source_created_at ?? r.message_created_time ?? r.created_time ?? null),
    last_seen_at: new Date().toISOString(),
    raw_payload: r.raw_payload ?? r,
    ingestion_source: "meta_n8n_polling"
  } });
}

// Keep n8n alive on polling windows with no eligible customer evidence.
// Route this status through an IF node (write_evidence = true) before the
// Supabase HTTP Upsert node; never send the status item to Supabase.
if (!output.length) return [{ json: {
  record_type: "sync_status",
  status: "no_customer_evidence",
  write_evidence: false,
  message_count: 0,
  synced_at: new Date().toISOString(),
} }];
return output.map(item => ({ json: { ...item.json, record_type: "customer_evidence", write_evidence: true } }));

// HTTP Request JSON body should pass the complete $json object.
// URL: /rest/v1/chat_customer_evidence?on_conflict=dedupe_key
// Headers: Prefer: resolution=merge-duplicates,return=minimal
