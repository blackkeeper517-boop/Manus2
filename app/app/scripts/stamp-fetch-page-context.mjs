import { readFileSync, writeFileSync } from "node:fs";
const path = "n8n/HERMES_FETCH_FACEBOOK_ALL.js";
let source = readFileSync(path, "utf8");
source = source.replaceAll('page_id: pageId,\n      page_name:', 'page_id: pageId,\n      source_page_id: pageId,\n      page_name:');
source = source.replaceAll('page_name: page.page_name ?? page.pageName ?? null,\n      system_status:', 'page_name: page.page_name ?? page.pageName ?? null,\n      source_page_name: page.page_name ?? page.pageName ?? null,\n      system_status:');
writeFileSync(path, source);
console.log("fetch page context stamped");
