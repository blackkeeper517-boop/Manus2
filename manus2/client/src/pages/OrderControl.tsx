import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  ExternalLink,
  Filter,
  Flame,
  Loader2,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const baht = new Intl.NumberFormat("th-TH");
type GeneratedSummary = { orderNumber: string; customerName: string; phone: string; address: string; product: string; cod: string; copyText: string };

function money(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${baht.format(value)} ฿`;
}

function timeLabel(value: string | null | undefined) {
  if (!value) return "ไม่ระบุเวลา";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusFor(order: { is_ready_to_pack: boolean; cod_check_status: string | null; audit_status: string | null; order_status: string | null; telegram_status: string | null }) {
  const cod = String(order.cod_check_status ?? "").toUpperCase();
  const audit = `${order.audit_status ?? ""} ${order.order_status ?? ""}`;
  if (cod && cod !== "PASS") return { label: "เช็คยอด", tone: "border-red-300 bg-red-50 text-red-700", icon: <AlertTriangle className="h-3 w-3" /> };
  if (!order.is_ready_to_pack || /ตรวจ|unmatch|check|missing|needs/i.test(audit)) return { label: "ต้องตรวจ", tone: "border-fuchsia-300 bg-amber-50 text-amber-700", icon: <ShieldAlert className="h-3 w-3" /> };
  if (String(order.telegram_status ?? "").toUpperCase() === "SENT") return { label: "ส่งแล้ว", tone: "border-sky-300 bg-sky-50 text-sky-700", icon: <Send className="h-3 w-3" /> };
  return { label: "แมปแล้ว", tone: "border-emerald-300 bg-emerald-50 text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> };
}

function StatCard({ label, value, detail, accent, icon }: { label: string; value: number; detail: string; accent: string; icon: React.ReactNode }) {
  return <Card className="rounded-2xl border-white/10 bg-[#131318] shadow-xl shadow-black/20"><CardContent className="flex items-center justify-between p-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString("th-TH")}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div><div className={`rounded-xl border border-white/10 p-3 ${accent}`}>{icon}</div></CardContent></Card>;
}

export default function OrderControl() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mapped" | "review" | "cod">("all");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftCustomer, setDraftCustomer] = useState("");
  const [draftProduct, setDraftProduct] = useState("");
  const [draftCod, setDraftCod] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const liveQuery = trpc.orders.live.useQuery({ search: search || undefined }, { refetchInterval: 30_000 });
  const orders = liveQuery.data?.orders ?? [];
  const stats = liveQuery.data?.stats;
  const summaryMutation = trpc.orders.generateSummary.useMutation({ onSuccess: setGeneratedSummary });

  useEffect(() => {
    if (!selectedNumber && orders[0]) setSelectedNumber(orders[0].order_number);
    if (selectedNumber && orders.length && !orders.some(order => order.order_number === selectedNumber)) setSelectedNumber(orders[0]?.order_number ?? null);
  }, [orders, selectedNumber]);

  const visibleOrders = useMemo(() => orders.filter(order => {
    if (filter === "all") return true;
    const status = statusFor(order).label;
    if (filter === "mapped") return status === "แมปแล้ว";
    if (filter === "review") return status === "ต้องตรวจ";
    return status === "เช็คยอด";
  }), [orders, filter]);
  const selectedOrder = orders.find(order => order.order_number === selectedNumber) ?? null;

  const copySummary = async () => {
    if (!selectedOrder) return;
    const items = selectedOrder.items.length ? selectedOrder.items.map(item => item.telegram_final_mapped || item.display_for_packer || `${item.sku ?? "สินค้า"} ${item.quantity ?? item.qty ?? 1} คอต`).join("\n") : selectedOrder.display_for_packer ?? `${selectedOrder.sku ?? "สินค้า"} ${selectedOrder.emoji ?? ""}`;
    const summary = [selectedOrder.order_number, selectedOrder.customer_name, selectedOrder.phone, selectedOrder.full_address, `COD ${money(selectedOrder.cod_amount)}`, items].filter(Boolean).join("\n");
    await navigator.clipboard?.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyGenerated = async () => {
    if (!generatedSummary) return;
    await navigator.clipboard?.writeText(generatedSummary.copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <div className="min-h-[calc(100vh-2rem)] bg-[#09090b] text-white">
    <div className="mx-auto max-w-[1680px] space-y-5 p-3 sm:p-5 lg:p-7">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111116] px-6 py-6 shadow-2xl shadow-black/30 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-fuchsia-700/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-fuchsia-300"><Flame className="h-3.5 w-3.5" /> NIGHTOPS · ORDER CONTROL</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">ห้องควบคุมออเดอร์</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">ยึด <span className="font-mono text-emerald-300">bb_orders</span> เป็นฐานออเดอร์หลัก พร้อมรองรับรายการสินค้า 2–3 รายการในออเดอร์เดียว</p></div>
          <div className="flex flex-wrap items-center gap-2"><Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE DATA</Badge><Badge variant="outline" className="border-fuchsia-500/30 bg-violet-500/5 text-fuchsia-300"><Database className="mr-1.5 h-3 w-3" /> Supabase</Badge><Button variant="outline" size="sm" onClick={() => liveQuery.refetch()} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"><RefreshCw className={`mr-2 h-3.5 w-3.5 ${liveQuery.isFetching ? "animate-spin" : ""}`} /> รีเฟรช</Button></div>
        </div>
      </header>

      <Card className={`rounded-2xl border ${liveQuery.isError ? "border-red-500/30 bg-red-950/20" : liveQuery.isFetching ? "border-amber-400/30 bg-amber-950/10" : "border-emerald-500/25 bg-emerald-950/10"}`}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className={`h-3 w-3 rounded-full ${liveQuery.isError ? "bg-red-400" : liveQuery.isFetching ? "animate-pulse bg-amber-300" : "bg-emerald-400"}`} /><div><p className="text-sm font-semibold text-white">{liveQuery.isError ? "บันทึก/อ่านออเดอร์ไม่ครบ" : liveQuery.isFetching ? "กำลังตรวจสอบข้อมูลออเดอร์…" : "สถานะสายออเดอร์พร้อม"}</p><p className="mt-1 text-xs text-slate-400">ระบบมองเห็นออเดอร์ใน <span className="font-mono text-emerald-300">bb_orders</span> <span className="font-mono text-fuchsia-200">{stats?.total ?? 0}</span> รายการ · รายการสินค้าอ่านจาก items_json</p></div></div><Badge className={liveQuery.isError ? "border-red-400/30 bg-red-400/10 text-red-300" : liveQuery.isFetching ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}>{liveQuery.isError ? "INCOMPLETE" : liveQuery.isFetching ? "CHECKING" : "LOADED"}</Badge></CardContent></Card>

      <Card className="overflow-hidden rounded-3xl border-fuchsia-500/20 bg-[#111116] shadow-2xl shadow-fuchsia-950/10"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-fuchsia-300"><Sparkles className="h-3.5 w-3.5" /> ADMIN ORDER SUMMARY</div><h2 className="mt-2 text-xl font-semibold text-white">วางที่อยู่ แล้วสร้างใบสรุปออเดอร์</h2><p className="mt-1 text-xs leading-5 text-slate-500">ระบบจะอ่านชื่อ เบอร์โทร ที่อยู่ สินค้า และ COD จากข้อความ แล้วสร้างเลข <span className="font-mono text-fuchsia-300">ORD</span> ให้อัตโนมัติ โดยยังไม่เขียนลงฐานข้อมูลจริง</p></div><Badge variant="outline" className="w-fit border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-200">DRAFT MODE</Badge></div><div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_0.6fr]"><textarea value={draftText} onChange={event => setDraftText(event.target.value)} placeholder={'ก๊อปข้อความลูกค้าหรือที่อยู่มาวางที่นี่…\nเช่น ชื่อ: สมชาย ใจดี\nโทร: 0812345678\nบ้านเลขที่…'} className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20" /><div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1"><Input value={draftCustomer} onChange={event => setDraftCustomer(event.target.value)} placeholder="ชื่อลูกค้า (ถ้ามี)" className="border-white/10 bg-black/30 text-white placeholder:text-slate-600" /><Input value={draftProduct} onChange={event => setDraftProduct(event.target.value)} placeholder="สินค้า / SKU (ถ้ามี)" className="border-white/10 bg-black/30 text-white placeholder:text-slate-600" /><Input value={draftCod} onChange={event => setDraftCod(event.target.value)} placeholder="COD (ถ้ามี)" className="border-white/10 bg-black/30 text-white placeholder:text-slate-600" /></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-600">{draftText.length.toLocaleString()} ตัวอักษร · แก้ไขข้อมูลได้ก่อนคัดลอก</span><Button disabled={!draftText.trim() || summaryMutation.isPending} onClick={() => summaryMutation.mutate({ rawText: draftText, customerName: draftCustomer, product: draftProduct, cod: draftCod })} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-950/30 hover:from-fuchsia-500 hover:to-violet-500"><Sparkles className="mr-2 h-4 w-4" />{summaryMutation.isPending ? "กำลังสรุป…" : "สร้างใบสรุป ORD"}</Button></div>{generatedSummary && <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]"><div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/[0.04] p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-lg font-semibold text-fuchsia-200">{generatedSummary.orderNumber}</p><Button size="sm" variant="outline" onClick={copyGenerated} className="border-fuchsia-400/20 bg-fuchsia-500/5 text-fuchsia-200 hover:bg-fuchsia-500/10">{copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Clipboard className="mr-2 h-3.5 w-3.5" />}{copied ? "คัดลอกแล้ว" : "คัดลอกใบสรุป"}</Button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-[10px] uppercase tracking-wider text-slate-600">ลูกค้า</p><p className="mt-1 text-slate-200">{generatedSummary.customerName}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">โทร</p><p className="mt-1 font-mono text-slate-300">{generatedSummary.phone || "ไม่ระบุ"}</p></div><div className="sm:col-span-2"><p className="text-[10px] uppercase tracking-wider text-slate-600">ที่อยู่</p><p className="mt-1 leading-6 text-slate-300">{generatedSummary.address || "ไม่ระบุที่อยู่"}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">สินค้า</p><p className="mt-1 text-slate-200">{generatedSummary.product}</p></div><div><p className="text-[10px] uppercase tracking-wider text-slate-600">COD</p><p className="mt-1 text-fuchsia-200">{generatedSummary.cod === "ไม่ระบุ" ? generatedSummary.cod : `${generatedSummary.cod} บาท`}</p></div></div></div><pre className="overflow-auto rounded-2xl border border-white/5 bg-black/40 p-4 font-mono text-xs leading-6 text-slate-400">{generatedSummary.copyText}</pre></div>}</CardContent></Card>

      {liveQuery.isError ? <Card className="rounded-2xl border-red-500/30 bg-red-950/20"><CardContent className="flex items-start gap-3 p-5 text-sm text-red-200"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" /><div><p className="font-semibold">อ่านข้อมูลจริงไม่สำเร็จ</p><p className="mt-1 text-red-200/70">ตรวจสอบ Supabase URL, service-role key และสิทธิ์อ่านตาราง `bb_orders` รวมถึง migration items_json</p><p className="mt-2 rounded-lg border border-red-300/10 bg-black/20 p-2 font-mono text-[11px] leading-5 text-red-100/80">{liveQuery.error.message}</p></div></CardContent></Card> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><StatCard label="ออเดอร์ที่โหลด" value={stats?.total ?? 0} detail="จาก bb_orders" accent="bg-fuchsia-500/10 text-fuchsia-300" icon={<PackageCheck className="h-5 w-5" />} /><StatCard label="แมปสำเร็จ" value={stats?.mapped ?? 0} detail="พร้อมไปขั้นตอนถัดไป" accent="bg-emerald-500/10 text-emerald-300" icon={<Check className="h-5 w-5" />} /><StatCard label="ต้องตรวจ" value={stats?.review ?? 0} detail="ข้อมูลยังไม่พร้อม" accent="bg-violet-500/10 text-fuchsia-300" icon={<ShieldAlert className="h-5 w-5" />} /><StatCard label="เช็คยอด" value={stats?.codCheck ?? 0} detail="COD ไม่ผ่านหรือยังไม่ระบุ" accent="bg-fuchsia-500/10 text-fuchsia-300" icon={<AlertTriangle className="h-5 w-5" />} /><StatCard label="เพจที่พบ" value={stats?.pages ?? 0} detail={`${stats?.sent ?? 0} รายการมีสถานะ SENT`} accent="bg-violet-500/10 text-fuchsia-300" icon={<MessageCircle className="h-5 w-5" />} /></div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111116] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><Filter className="ml-1 h-4 w-4 text-slate-500" />{([ ["all", "ทั้งหมด", stats?.total ?? 0], ["mapped", "แมปแล้ว", stats?.mapped ?? 0], ["review", "ต้องตรวจ", stats?.review ?? 0], ["cod", "เช็คยอด", stats?.codCheck ?? 0] ] as const).map(([key, label, count]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-xs transition ${filter === key ? "bg-fuchsia-500 font-semibold text-black" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{label} <span className="ml-1 opacity-60">{count}</span></button>)}</div><div className="relative sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาออเดอร์, ลูกค้า, SKU…" className="h-9 rounded-xl border-white/10 bg-black/20 pl-9 text-sm text-white placeholder:text-slate-600 focus-visible:ring-amber-400" /></div></div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        <Card className="overflow-hidden rounded-3xl border-white/10 bg-[#111116] shadow-2xl shadow-black/20"><CardContent className="p-0"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-fuchsia-300">INCOMING QUEUE</p><h2 className="mt-1 text-lg font-semibold">รายการออเดอร์</h2></div><span className="text-xs text-slate-500">{liveQuery.isLoading ? "กำลังอ่านข้อมูล…" : `${visibleOrders.length} รายการ`}</span></div><div className="max-h-[650px] overflow-y-auto p-3">{liveQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านข้อมูลจาก Supabase…</div> : visibleOrders.length === 0 ? <div className="p-12 text-center text-sm text-slate-500"><Search className="mx-auto mb-3 h-7 w-7 text-slate-700" />ไม่พบออเดอร์ตามเงื่อนไขนี้</div> : visibleOrders.map(order => { const status = statusFor(order); return <button key={order.order_number} onClick={() => setSelectedNumber(order.order_number)} className={`group mb-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${selectedNumber === order.order_number ? "border-fuchsia-400/60 bg-fuchsia-500/5" : "border-white/5 bg-black/10 hover:border-white/15 hover:bg-white/[0.03]"}`}><div className={`h-11 w-1 shrink-0 rounded-full ${status.label === "เช็คยอด" ? "bg-red-500" : status.label === "ต้องตรวจ" ? "bg-fuchsia-500" : "bg-emerald-400"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-slate-300">{order.order_number}</span><Badge variant="outline" className={`gap-1 px-2 py-0.5 text-[10px] ${status.tone}`}>{status.icon}{status.label}</Badge></div><p className="mt-2 truncate text-sm font-semibold text-slate-100">{order.emoji ?? "📦"} {order.display_for_packer || order.th_name || order.sku || "ไม่ระบุสินค้า"}</p><p className="mt-1 truncate text-xs text-slate-500">{order.customer_name || "ไม่ระบุชื่อลูกค้า"} <span className="mx-1 text-slate-700">·</span> {order.page_name || "ไม่ระบุเพจ"}</p></div><div className="shrink-0 text-right"><p className="text-xs text-slate-500">{timeLabel(order.order_time || order.created_at)}</p><p className="mt-2 text-sm font-semibold text-fuchsia-300">{money(order.cod_amount)}</p></div></button>; })}</div></CardContent></Card>

        <Card className="overflow-hidden rounded-3xl border-white/10 bg-[#111116] shadow-2xl shadow-black/20 xl:sticky xl:top-5 xl:self-start"><CardContent className="p-0">{selectedOrder ? <><div className="flex items-start justify-between border-b border-white/10 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-fuchsia-300">ORDER INSPECTOR</p><h2 className="mt-1 font-mono text-lg font-semibold">{selectedOrder.order_number}</h2></div><button onClick={() => setSelectedNumber(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="ปิดรายละเอียด"><X className="h-4 w-4" /></button></div><div className="space-y-5 p-5"><div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="rounded-full bg-emerald-400/10 p-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-emerald-200">{statusFor(selectedOrder).label}</p><p className="mt-1 text-xs leading-5 text-slate-400">{selectedOrder.audit_flags || selectedOrder.cod_check_status || "สถานะจากข้อมูลจริงในฐานข้อมูล"}</p></div></div><section><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">PRODUCT PAYLOAD</p><div className="space-y-2">{(selectedOrder.items.length ? selectedOrder.items : [{ id: 0, sku: selectedOrder.sku, th_name: selectedOrder.th_name, emoji: selectedOrder.emoji, display_for_packer: selectedOrder.display_for_packer, quantity:  selectedOrder.items.length ? 0 : null, unit_price: null, expected_cod: selectedOrder.expected_cod }]).map((item, index) => <div key={`${item.id ?? "line"}-${index}`} className="rounded-2xl border border-white/5 bg-black/20 p-3"><div className="flex items-start gap-3"><span className="text-xl">{item.emoji ?? selectedOrder.emoji ?? "📦"}</span><div className="min-w-0 flex-1"><p className="font-mono text-xs font-semibold text-slate-200">{item.sku || "ไม่ระบุ SKU"}</p><p className="mt-1 text-xs text-slate-400">{item.display_for_packer || item.th_name || "ไม่ระบุรายละเอียดสินค้า"}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-600">จำนวน</p><p className="mt-1 text-slate-300">{item.quantity ?? item.qty ?? selectedOrder.items.length ? `${item.quantity ?? item.qty ?? 1} คอต` : "—"}</p></div><div><p className="text-slate-600">ราคาต่อหน่วย</p><p className="mt-1 text-fuchsia-300">{money(item.unit_price)}</p></div><div><p className="text-slate-600">ยอดสินค้า</p><p className="mt-1 text-fuchsia-300">{money(item.expected_cod)}</p></div></div></div>)}</div></section><section><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">CUSTOMER CONTEXT</p><div className="space-y-2 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm"><p className="font-semibold text-slate-100">{selectedOrder.customer_name || "ไม่ระบุชื่อ"}</p><p className="text-slate-400">{selectedOrder.phone || "ไม่ระบุเบอร์โทร"}</p><p className="leading-6 text-slate-400">{selectedOrder.full_address || "ไม่ระบุที่อยู่"}</p><div className="flex items-center gap-2 pt-2 text-xs text-slate-600"><Clock3 className="h-3.5 w-3.5" /> {selectedOrder.page_name || "ไม่ระบุเพจ"}</div></div></section><div className="grid grid-cols-2 gap-2"><Button onClick={copySummary} variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">{copied ? <Check className="mr-2 h-4 w-4 text-emerald-300" /> : <Clipboard className="mr-2 h-4 w-4" />}{copied ? "คัดลอกแล้ว" : "คัดลอกสรุป"}</Button><Button disabled className="bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white opacity-70"><Send className="mr-2 h-4 w-4" /> ต่อ Atomic Claim</Button></div></div></> : <div className="flex min-h-[560px] flex-col items-center justify-center p-8 text-center text-slate-500"><Sparkles className="mb-4 h-8 w-8 text-fuchsia-300/50" /><p className="text-sm">เลือกออเดอร์เพื่อดูรายละเอียด</p><p className="mt-1 text-xs text-slate-600">ข้อมูลจะแสดงจากตารางจริงเท่านั้น</p></div>}</CardContent></Card>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 px-2 text-[11px] text-slate-600"><span className="flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Primary: bb_orders · Archive: bb_order / bb_order_items_fix</span><span>{liveQuery.data?.fetchedAt ? `ดึงข้อมูลล่าสุด ${timeLabel(liveQuery.data.fetchedAt)}` : "กำลังรอข้อมูล"}</span></footer>
    </div>
  </div>;
}
