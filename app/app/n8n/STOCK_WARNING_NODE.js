// n8n Code node: ⚠️ STOCK_WARNING_NODE
// Run Once for All Items
// Route output to Telegram/logging/UI alert branch.

const warnings = [];
for (const item of $input.all()) {
  const r = item.json ?? {};
  const qty = Number(r.stock_qty ?? r.stockQty ?? 0);
  const sku = String(r.sku ?? "UNKNOWN");
  const label = String(r.label_display ?? r.display_for_packer ?? r.th_name ?? sku);
  if (qty <= 0) warnings.push({ json: { warning_type: "OUT_OF_STOCK", severity: "critical", sku, label, stock_qty: qty, message: `❌ สินค้าหมด: ${label} (${sku})` } });
  else if (qty <= 5) warnings.push({ json: { warning_type: "LOW_STOCK", severity: "warning", sku, label, stock_qty: qty, message: `⚠️ สต๊อกเหลือน้อย ${qty}: ${label} (${sku})` } });
}
return warnings;
