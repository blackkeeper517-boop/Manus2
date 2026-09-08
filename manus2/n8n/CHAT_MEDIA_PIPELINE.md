# NIGHTOPS Meta Image Archiving and Speed Plan

## Conclusion

The stable design is a **separate media branch** after the customer and page processors. The existing message branch continues to upsert chat rows immediately. The media branch downloads only messages that contain an external Meta image URL, uploads the binary to the Supabase Storage bucket `chat-media`, and patches the matching row by its existing `dedupe_key`. This prevents media latency from delaying text ingestion and keeps the current exact-ID speaker classification unchanged.

Run `n8n/chat-media-storage.sql` once in the Supabase SQL Editor before enabling the media branch.

## Required node sequence

| Order | Node | Configuration |
|---|---|---|
| 1 | `💬 CUSTOMER_CHAT_PROCESSOR` | Keep the existing Supabase upsert branch. Also connect its output to the media branch. |
| 2 | `🟣 PAGE_CHAT_PROCESSOR` | Keep the existing Supabase upsert branch. Also connect its output to the media branch. |
| 3 | `🖼️ HERMES_MEDIA_PREPARE` | Code node, Run Once for All Items. Use `HERMES_MEDIA_PREPARE.js`. |
| 4 | `IF · has source image` | Continue only when `{{$json.source_url}}` starts with `http`. The Code node already returns `[]` when no media exists. |
| 5 | `HTTP · Meta image download` | Method `GET`; URL `={{$json.source_url}}`; response format `File`; binary property `data`; enable the option that keeps the input JSON. Do not log the response body. |
| 6 | `HTTP · Supabase Storage upload` | Method `POST`; URL `={{$env.SUPABASE_URL}}/storage/v1/object/chat-media/{{$json.storage_key}}`; send the binary property `data`; header `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`; header `apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}`; header `Content-Type: {{$binary.data.mimeType || 'image/jpeg'}}`; header `x-upsert: true`. |
| 7 | `🖼️ HERMES_MEDIA_PATCH_BUILD` | Code node, Run Once for All Items. Use `HERMES_MEDIA_PATCH_BUILD.js`. |
| 8 | `HTTP · Patch permanent URL` | Method `PATCH`; URL `={{$json.patch_url}}`; JSON body `={{$json.patch_body}}`; headers `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`, `apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}`, `Content-Type: application/json`, `Prefer: return=minimal`. |

The upload node must preserve the JSON fields from the previous item. If the n8n version uses a different label, use the option named **Include Input Data**, **Keep Input**, or **Put Output in Field** so `dedupe_key`, `storage_key`, and `storage_table` remain available after the binary request.

## Branch wiring

```text
HERMES_CHAT_CHUNK_SPLITTER
  ├─> CUSTOMER_CHAT_PROCESSOR ─> Supabase upsert: chat_customer_messages
  │                            └─> HERMES_MEDIA_PREPARE
  └─> PAGE_CHAT_PROCESSOR     ─> Supabase upsert: chat_page_messages
                               └─> HERMES_MEDIA_PREPARE

HERMES_MEDIA_PREPARE
  └─> Meta image download
      └─> Supabase Storage upload
          └─> HERMES_MEDIA_PATCH_BUILD
              └─> PATCH matching chat row by dedupe_key
```

If the two processors connect to one media-preparation node, n8n may execute both branches separately. The node is idempotent because the object path and row key are derived from `dedupe_key` and image index. The Supabase upsert remains the final duplicate guard.

## What is stored

The original Meta payload remains in `attachments_json` and `raw_payload`. The permanent URL is written to `permanent_image_urls`. The status is one of `not_required`, `pending`, `stored`, or `failed`. A media failure must not block the text row. Add an error-handling output on the download and upload nodes that PATCHes `media_status: failed` and stores a short `media_error`.

The public URL format is:

```text
https://<project-ref>.supabase.co/storage/v1/object/public/chat-media/<storage-key>
```

Meta URLs may expire. The permanent URL is the URL the Chat Hub should prefer when rendering archived images.

## How to make the system faster safely

| Improvement | Expected effect | Safety rule |
|---|---|---|
| Keep media on a separate branch | Text appears without waiting for image download | Never make the text upsert depend on media success |
| Fetch only new conversations/messages | Fewer Graph API calls and less n8n work | Keep `source_message_id`/`dedupe_key` unchanged |
| Reduce message page size after initial backfill | Lower response size and parse time | Use a larger limit only for the one-time backfill |
| Use one page per n8n item as now | Predictable 7-page execution | Do not fan out one config item into seven HTTP calls |
| Run media downloads with bounded concurrency | Faster archives without Meta/storage overload | Use batches of 3–5, not unlimited parallel requests |
| Add indexes on `(page_id, conversation_key, occurred_at)` and media status | Faster chat reads and retry scans | Apply the SQL once and verify indexes exist |
| Prefer permanent URLs in UI, fall back to Meta URLs | Stable rendering after Meta expiry | Keep both fields for auditability |
| Avoid full `select=*` on normal chat reads | Smaller responses and faster UI | Request only columns used by the UI |

The first practical speed improvement is **separating media from ingestion**. The second is reducing the Graph API time range or message limit after the initial historical capture. Do not increase concurrency before observing Meta rate-limit responses.

## Verification checklist

After applying the SQL and wiring the nodes, test one customer image and one page image. Confirm the following values without printing tokens: the row keeps the same `dedupe_key`, `media_status` becomes `stored`, `permanent_image_urls` contains one URL, the object exists in `chat-media`, and the Chat Hub renders the permanent URL after a new fetch cycle. Re-run the same n8n execution and confirm no duplicate object or duplicate message row is created.

References

[1]: https://supabase.com/docs/guides/storage/uploads/standard-uploads "Supabase Storage standard uploads"
[2]: https://developers.facebook.com/docs/messenger-platform/send-messages "Meta Messenger Platform send messages"
