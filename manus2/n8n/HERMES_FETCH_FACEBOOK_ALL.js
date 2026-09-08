// n8n Code node: 🌌 HERMES_FETCH_FACEBOOK_ALL
// Mode: Run Once for All Items
// Input: 🔮 BB_EMPIRE_DATABASE_FLATTEN (1 item = 1 enabled page).
// n8n executes the HTTP request once per input item; no config lookup loop here.

const now = new Date();
const since = new Date(now.getTime() - 5 * 60 * 60 * 1000);
const fields = "id,updated_time,message_count,unread_count,participants,can_reply,messages.limit(30){id,message,created_time,from{id,name},is_echo,attachments{mime_type,name,size,type,file_url,url,payload{url,sticker_id}},shares{name,link},sticker}";

function errorText(error) {
  const value = error ?? {};
  const details = value.response?.data ?? value.response?.body ?? value.body ?? value.cause?.response?.data;
  if (details) return typeof details === "string" ? details : JSON.stringify(details);
  if (value.message) return String(value.message);
  try { return JSON.stringify(value); } catch { return "Unknown Facebook API error"; }
}

const output = [];
for (const item of $input.all()) {
  const page = item.json ?? {};
  const pageId = String(page.page_id ?? page.pageId ?? "");
  const token = String(page.access_token ?? page.page_access_token ?? page.pageAccessToken ?? page.token ?? "");
  const status = String(page.system_status ?? page.status ?? "OFF").toUpperCase();

  if (!pageId || status !== "ON" || !token) continue;

  try {
    const response = await this.helpers.httpRequest({
      method: "GET",
      url: `https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/conversations`,
      qs: { fields, limit: "30", since: since.toISOString(), until: now.toISOString(), access_token: token },
      json: true,
    });
    output.push({ json: {
      page_index: page.page_index ?? page.pageIndex ?? page.row_number ?? null,
      page_id: pageId,
      source_page_id: pageId,
      page_name: page.page_name ?? page.pageName ?? null,
      source_page_name: page.page_name ?? page.pageName ?? null,
      system_status: status,
      assigned_agent: page.assigned_agent ?? page.assignedAgent ?? null,
      assigned_hashtag: page.assigned_hashtag ?? page.assigned_Hashtag ?? null,
      fetched_at: now.toISOString(),
      fetch_status: "success",
      facebook_response: response,
    } });
  } catch (error) {
    output.push({ json: {
      page_index: page.page_index ?? page.pageIndex ?? page.row_number ?? null,
      page_id: pageId,
      source_page_id: pageId,
      page_name: page.page_name ?? page.pageName ?? null,
      source_page_name: page.page_name ?? page.pageName ?? null,
      system_status: status,
      fetched_at: now.toISOString(),
      fetch_status: "error",
      fetch_error: errorText(error),
      facebook_response: { data: [] },
    } });
  }
}
return output;

// Security: access_token is used only inside this node and is never returned.
// Existing order workflow stays separate; connect this output to HERMES_CHAT_RAW_ALL.
