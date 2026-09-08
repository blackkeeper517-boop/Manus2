import { readFileSync, writeFileSync } from "node:fs";
const path = "/home/ubuntu/thai-order-project-vault/n8n/thai-order-chat-branch-added.json";
const workflow = JSON.parse(readFileSync(path, "utf8"));
const fields = "id,updated_time,message_count,unread_count,participants,can_reply,messages.limit(15){id,message,created_time,from{id,name},is_echo,attachments{type,mime_type,name,size,url,file_url,payload{url,sticker_id}},shares{name,link},sticker}";
for (const node of workflow.nodes ?? []) {
  if (node.name !== "🌌HERMES_DATA_JOURNEY1") continue;
  const parameters = node.parameters ?? {};
  parameters.url = `=https://graph.facebook.com/v20.0/{{ $json.page_id }}/conversations?fields=${fields}`;
  const query = parameters.queryParameters?.parameters ?? [];
  const access = query.find(parameter => parameter.name === "access_token");
  if (access) access.value = "={{ $json.access_token }}";
  const limit = query.find(parameter => parameter.name === "limit");
  if (limit) limit.value = "30";
  node.parameters = parameters;
}
writeFileSync(path, JSON.stringify(workflow, null, 2) + "\n");
console.log(`updated=${path}`);
console.log(`fields=${fields}`);
