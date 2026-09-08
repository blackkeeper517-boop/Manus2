import { fetchLiveThreads } from "../server/supabase";

const threads = await fetchLiveThreads();
const pages = new Set(threads.map(thread => thread.pageName));
const customerThreads = threads.filter(thread => String(thread.customerName ?? "").trim() !== "").length;
console.log(JSON.stringify({ threadCount: threads.length, pageCount: pages.size, customerThreads }));
