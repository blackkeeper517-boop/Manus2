import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../n8n/CUSTOMER_CHAT_PROCESSOR.js", import.meta.url), "utf8");
const fn = new Function("$input", `return (function(){\n${source}\n}).call({});`);

const output = fn({ all: () => [
  { json: { message_id: "old-customer-1", page_id: "page-1", conversation_id: "thread-1", message: "ลูกค้ารุ่นเก่า", from: { id: "customer-1", name: "ลูกค้า" }, created_time: "2026-09-04T12:00:00Z" } },
  { json: { message_id: "old-page-1", page_id: "page-1", conversation_id: "thread-1", message: "ตอบจากเพจ", from: { id: "page-1", name: "เพจ" }, is_echo: true } },
] });

if (output.length !== 1 || output[0].json.customer_id !== "customer-1" || output[0].json.speaker_type !== "customer") {
  throw new Error(`Old-shape customer mapping failed: ${JSON.stringify(output)}`);
}
console.log(JSON.stringify(output, null, 2));
