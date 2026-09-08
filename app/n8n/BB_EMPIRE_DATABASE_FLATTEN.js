// n8n Code node: 🔮 BB_EMPIRE_DATABASE_FLATTEN
// Mode: Run Once for All Items
// Input may be 7 items, one array item, or { data: [...] }.
// Output is exactly one item per enabled page.

const rows = [];
for (const item of $input.all()) {
  const value = item.json ?? {};
  if (Array.isArray(value)) rows.push(...value);
  else if (Array.isArray(value.data)) rows.push(...value.data);
  else if (Array.isArray(value.pages)) rows.push(...value.pages);
  else rows.push(value);
}

const pages = rows.map(page => ({
  page_index: String(page.page_index ?? page.pageIndex ?? page.row_number ?? ""),
  page_id: String(page.page_id ?? page.pageId ?? ""),
  page_name: page.page_name ?? page.pageName ?? null,
  system_status: String(page.system_status ?? page.status ?? "OFF").toUpperCase(),
  access_token: String(page.access_token ?? page.page_access_token ?? page.pageAccessToken ?? page.token ?? ""),
  assigned_agent: page.assigned_agent ?? page.assignedAgent ?? null,
  assigned_hashtag: page.assigned_hashtag ?? page.assigned_Hashtag ?? null,
})).filter(page => page.page_id && page.system_status === "ON" && page.access_token);

if (!pages.length) throw new Error("ไม่พบเพจ ON ที่มี page_id และ access_token");
return pages.map(page => ({ json: page }));

// Expected output: 1 item = 1 page. For 7 enabled pages, output must be 7 items.
// Never connect access_token beyond the Facebook HTTP/API fetch node.
