import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../n8n/HERMES_CHAT_RAW_ALL.js", import.meta.url), "utf8");

async function run(input) {
  const fn = new Function("$input", `return (async function n8nCodeNode(){\n${source}\n}).call({});`);
  return await fn({ all: () => input.map(json => ({ json })) });
}

const empty = await run([
  {
    page_id: "1032290633303246",
    page_name: "💬ร้าน:เจ๊ B",
    fetched_at: "2026-09-04T10:00:00.000Z",
    fetch_status: "success",
    facebook_response: { data: [] },
  },
]);
if (empty.length !== 0) {
  throw new Error(`Empty case failed: ${JSON.stringify(empty)}`);
}

const sample = await run([
  {
    page_index: "BB_07",
    page_id: "1032290633303246",
    page_name: "💬ร้าน:เจ๊ B",
    fetched_at: "2026-09-04T10:00:00.000Z",
    fetch_status: "success",
    facebook_response: {
      data: [{
        id: "thread-1",
        updated_time: "2026-09-04T09:18:00+00:00",
        message_count: 2,
        unread_count: 1,
        can_reply: true,
        participants: { data: [{ id: "1032290633303246", name: "ร้าน:เจ๊ B" }, { id: "customer-1", name: "สมบัติ" }] },
        messages: { data: [
          { id: "customer-msg-1", message: "ขอรายละเอียดสินค้า", created_time: "2026-09-04T09:17:00+00:00", from: { id: "customer-1", name: "สมบัติ" }, is_echo: false, attachments: { data: [{ type: "image", payload: { url: "https://cdn.example.test/customer-photo.jpg" } }] } },
          { id: "page-msg-1", message: "มีบริการเก็บเงินปลายทาง", created_time: "2026-09-04T09:17:40+00:00", from: { id: "1032290633303246", name: "ร้าน:เจ๊ B", email: "1032290633303246@facebook.com" } },
        ] },
      }],
    },
  },
]);

const messages = sample.filter(item => item.json.record_type === "message");
if (messages.length !== 2) throw new Error(`Message count failed: ${JSON.stringify(sample)}`);
const customer = messages.find(item => item.json.message_id === "customer-msg-1");
const page = messages.find(item => item.json.message_id === "page-msg-1");
if (customer?.json.speaker_hint !== "customer") throw new Error("Customer classification failed");
if (page?.json.speaker_hint !== "page") throw new Error("Page classification failed");
if (page?.json.message_from_is_page !== true) throw new Error("Explicit page marker classification failed");
if (page?.json.message_created_time !== "2026-09-04T09:17:40+00:00") throw new Error("Page timestamp preservation failed");
if (page?.json.page_id !== "1032290633303246") throw new Error("Page context preservation failed");
if (customer?.json.has_image !== true || customer?.json.image_urls?.[0] !== "https://cdn.example.test/customer-photo.jpg") throw new Error("Image URL extraction failed");

console.log(JSON.stringify({
  empty_case: empty,
  sample_case: messages.map(item => ({
    message_id: item.json.message_id,
    speaker_hint: item.json.speaker_hint,
    occurred_at: item.json.occurred_at,
    page_id: item.json.page_id,
    conversation_key: item.json.conversation_key,
  })),
}, null, 2));
