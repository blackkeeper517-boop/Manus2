import { describe, expect, it } from "vitest";
import { generateOrderSummary } from "./order-summary";

describe("generateOrderSummary", () => {
  it("creates an ORD number and extracts common Thai order fields", () => {
    const result = generateOrderSummary({
      rawText: "ชื่อ: สมชาย ใจดี\nโทร: 081-234-5678\nบ้านเลขที่ 99/1 หมู่ 2 ต.บางรัก อ.เมือง จ.นนทบุรี 11000\nสินค้า: MANGO_GREEN 2 คอต\nCOD: 1,250",
    }, new Date("2026-09-04T02:22:58.000Z"));

    expect(result.orderNumber).toBe("ORD-040926-092258");
    expect(result.customerName).toBe("สมชาย ใจดี");
    expect(result.phone).toBe("0812345678");
    expect(result.address).toContain("99/1");
    expect(result.product).toContain("MANGO_GREEN");
    expect(result.cod).toBe("1,250");
    expect(result.copyText).toContain("ORD-040926-092258");
  });

  it("allows admin overrides for ambiguous pasted content", () => {
    const result = generateOrderSummary({
      rawText: "ส่งที่ 12/4 ถนนสุขุมวิท กรุงเทพฯ 10110",
      customerName: "ลูกค้าหน้าร้าน",
      product: "SKU-RED 1 คอต",
      cod: "450",
    });

    expect(result.customerName).toBe("ลูกค้าหน้าร้าน");
    expect(result.product).toBe("SKU-RED 1 คอต");
    expect(result.cod).toBe("450");
    expect(result.copyText).toContain("450 บาท");
  });

  it("maps Thai product aliases to the standard label used by the mapping workflow", () => {
    const result = generateOrderSummary({
      rawText: "ชื่อ Hz บ้านเลขที่ 58 ถนนลงหาดบางแสน ต.แสนสุข อ.เมือง จ.ชลบุรี 20130 เบอร์ 0930002488✅ เซียร่าเขียว 1",
    }, new Date("2026-09-04T08:32:14.000Z"));

    expect(result.product).toBe("🟩 SEVIOS_GREEN(ซีวอสเขียว) 1 คอต");
    expect(result.copyText).toContain("🟩 SEVIOS_GREEN(ซีวอสเขียว) 1 คอต");
  });

  it("parses a compact single-line COD order", () => {
    const result = generateOrderSummary({
      rawText: "COD 200 อมรยินดีพจน์ บ้านเลขที่355 ซอยเพชรเกษม112 แขวงหนองค้างพลู เขตหนองเเขม กรุงเทพ10160เบอร์0620090155✅ ซีวอสแดง 1",
    }, new Date("2026-09-04T08:42:28.000Z"));

    expect(result.customerName).toBe("อมรยินดีพจน์");
    expect(result.phone).toBe("0620090155");
    expect(result.address).toContain("บ้านเลขที่355");
    expect(result.address).toContain("กรุงเทพ10160");
    expect(result.product).toBe("🟥 SEVIOS_RED(ซีวอสแดง) 1 คอต");
    expect(result.cod).toBe("200");
  });

  it("uses an active admin alias before the fallback dictionary", () => {
    const result = generateOrderSummary({
      rawText: "ชื่อ ทดสอบ 0812345678 สินค้า เขียวพิเศษ 2",
      productAliases: [{ alias: "เขียวพิเศษ", canonicalLabel: "🟩 CUSTOM_GREEN(เขียวพิเศษ)", isActive: true }],
    });

    expect(result.product).toBe("🟩 CUSTOM_GREEN(เขียวพิเศษ) 2 คอต");
  });

  it("keeps multiple products and quantities as separate summary lines", () => {
    const result = generateOrderSummary({
      rawText: "ชื่อ: ลูกค้าหลายชิ้น\nโทร: 0812345678\nที่อยู่: 99/1 กรุงเทพฯ 10110\nสินค้า: MOND_GREEN 2 คอต, SEVIOS_RED 1 คอต\nCOD: 850",
    });

    expect(result.product).toContain("🟩 MOND_GREEN(มอนด์เขียว) 2 คอต");
    expect(result.product).toContain("🟥 SEVIOS_RED(ซีวอสแดง) 1 คอต");
    expect(result.product.split("\n")).toHaveLength(2);
    expect(result.copyText).toContain("🟩 MOND_GREEN(มอนด์เขียว) 2 คอต\n🟥 SEVIOS_RED(ซีวอสแดง) 1 คอต");
  });
});
