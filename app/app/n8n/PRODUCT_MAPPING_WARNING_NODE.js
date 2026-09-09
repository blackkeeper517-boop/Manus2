// n8n Code node: ⚠️ PRODUCT_MAPPING_WARNING_NODE
// Run Once for All Items
// Route output to product-review queue or Telegram alert branch.

const warnings = [];
for (const item of $input.all()) {
  const r = item.json ?? {};
  const status = String(r.mapping_status ?? r.color_mapping_status ?? "").toUpperCase();
  const candidates = Array.isArray(r.candidate_skus) ? r.candidate_skus : [];
  if (!["MATCHED", "RESOLVED"].includes(status)) {
    const source = String(r.raw_order_for_discovery ?? r.product_text ?? r.product_name ?? r.alias ?? "").slice(0, 500);
    warnings.push({ json: { warning_type: status === "AMBIGUOUS" || status === "CHECK_PRODUCT" ? "AMBIGUOUS_PRODUCT" : "UNMAPPED_PRODUCT", severity: "warning", source_text: source, candidate_skus: candidates, message: `🟡 ต้องตรวจสอบสินค้า: ${source || "ไม่พบข้อความสินค้า"}` } });
  }
}
return warnings;
