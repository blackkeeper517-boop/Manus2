// n8n Code node: 🌌 HERMES_CHAT_RAW_ALL - CHAT ONLY MODE
// ไม่ทำออเดอร์ ไม่ทำ 87 คอลัมน์ มีเฉพาะข้อมูลแชทที่จำเป็น
// Mode: Run Once for All Items

const output = [];
const seen = new Set();

const MASTERCONFIG = [
  { page_id: "103411062505149", page_name: "🎀BBεїзเบอร์หนึ่งสโตร์" },
  { page_id: "113923148350742", page_name: "🎶BB ↠ STORE" },
  { page_id: "111414924711459", page_name: "🍇BBสโตร์." },
  { page_id: "1047257891810878", page_name: "💗Bb store๐" },
  { page_id: "1064404466767377", page_name: "เจ๊บี 🅱🅱" },
  { page_id: "1235719106287717", page_name: "🛒ร้าน:เจ๊บี" },
  { page_id: "1032290633303246", page_name: "💬ร้าน:เจ๊ B" },
];
const PAGE_MAP = new Map(MASTERCONFIG.map(page => [String(page.page_id), page.page_name]));

function getThreads(value) {
  if (Array.isArray(value?.data)) return value.data;
  if (value && typeof value === "object" && Object.keys(value).every(key => /^\d+$/.test(key))) return Object.values(value);
  if (Array.isArray(value)) return value;
  return [value];
}

for (const item of $input.all()) {
  const threads = getThreads(item.json);

  for (const thread of threads) {
    if (!thread) continue;
    const participants = thread.participants?.data ?? [];
    const messages = thread.messages?.data ?? thread.data?.data ?? [];
    const conversationId = String(thread.id ?? "");

    for (const message of messages) {
      if (!message?.id || seen.has(message.id)) continue;
      seen.add(message.id);

      const text = String(message.message ?? "").trim();
      if (!text) continue;

      let pageId = "";
      let pageName = "";
      for (const participant of participants) {
        const participantId = String(participant?.id ?? "");
        if (PAGE_MAP.has(participantId)) {
          pageId = participantId;
          pageName = PAGE_MAP.get(participantId) ?? "";
          break;
        }
      }

      const fromId = String(message.from?.id ?? "");
      const isPage = fromId === pageId;
      const customer = participants.find(participant => String(participant?.id ?? "") !== pageId) ?? message.from;
      const createdAt = message.created_time ?? new Date().toISOString();

      output.push({
        json: {
          Page_ID: pageId,
          Page_Name: pageName,
          conversation_id: conversationId,
          customer_name: customer?.name ?? message.from?.name ?? "",
          customer_id: customer?.id ?? "",
          message_id: message.id,
          message_text: text,
          speaker: isPage ? "page" : "customer",
          message_from_name: message.from?.name ?? "",
          time: createdAt,
          time_th: new Date(createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        },
      });
    }
  }
}

return output;

// Customer branch: filter speaker == "customer" → chat_customer_messages
// Page branch: filter speaker == "page" → chat_page_messages
// Dedupe source: message_id
