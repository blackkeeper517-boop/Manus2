// n8n Code node: 🕒 CHAT_TIME_NORMALIZER
// Mode: Run Once for All Items
// Put immediately before the Supabase HTTP Request node.
// Converts Thai display timestamps to UTC ISO for timestamptz columns.

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

const output = [];
for (const item of $input.all()) {
  const r = { ...(item.json ?? {}) };
  const occurred = normalizeTimestamp(r.occurred_at ?? r.message_created_time ?? r.created_time ?? r.time);
  const sourceCreated = normalizeTimestamp(r.source_created_at ?? r.message_created_time ?? r.created_time ?? r.time);
  if (occurred) r.occurred_at = occurred;
  if (sourceCreated) r.source_created_at = sourceCreated;
  if (r.synced_at) r.synced_at = normalizeTimestamp(r.synced_at) ?? new Date().toISOString();
  else r.synced_at = new Date().toISOString();
  output.push({ json: r });
}
return output.length ? output : [{ json: { record_type: "sync_status", status: "no_time_rows", write_evidence: false } }];
