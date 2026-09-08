import { fetchLiveOrders } from "../server/supabase";

const orders = await fetchLiveOrders();
const withItems = orders.filter(order => order.items.length > 0);
const itemCount = orders.reduce((sum, order) => sum + order.items.length, 0);
console.log(JSON.stringify({ orderCount: orders.length, ordersWithItems: withItems.length, linkedItemCount: itemCount }));
