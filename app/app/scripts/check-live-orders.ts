import { fetchLiveOrders, getLiveOrderStats } from "../server/supabase";

const orders = await fetchLiveOrders();
const stats = getLiveOrderStats(orders);
console.log(JSON.stringify({
  orderCount: orders.length,
  stats,
  firstOrderNumber: orders[0]?.order_number ?? null,
  firstItemCount: orders[0]?.items.length ?? 0,
}));
