import { fetchLiveOrders } from "../server/supabase";

const orders = await fetchLiveOrders();
const filled = (key: "customer_name" | "phone" | "full_address") => orders.filter(order => String(order[key] ?? "").trim() !== "").length;
console.log(JSON.stringify({ orderCount: orders.length, customerName: filled("customer_name"), phone: filled("phone"), address: filled("full_address") }));
