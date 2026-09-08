import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, BarChart3, Database, RefreshCw, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function timing(row: { metadata: unknown }) {
  const value = row.metadata && typeof row.metadata === "object" ? (row.metadata as { timingMs?: Record<string, unknown> }).timingMs : undefined;
  return {
    total: Number(value?.total ?? 0),
    dataLookup: Number(value?.dataLookup ?? 0),
    parse: Number(value?.parse ?? 0),
    audit: Number(value?.audit ?? 0),
  };
}

export default function OrderPerformance() {
  const query = trpc.orders.summaryTimings.useQuery({ limit: 50 }, { refetchInterval: 60_000 });
  const rows = query.data ?? [];
  const chartData = rows.slice(0, 12).reverse().map((row, index) => {
    const value = timing(row);
    return { name: row.orderNumber || `#${index + 1}`, total: value.total, data: value.dataLookup, parse: value.parse };
  });
  const totals = rows.map(timing);
  const avg = (key: "total" | "dataLookup" | "parse" | "audit") => totals.length ? Math.round(totals.reduce((sum, item) => sum + item[key], 0) / totals.length) : 0;
  const max = (key: "total" | "dataLookup" | "parse" | "audit") => totals.length ? Math.max(...totals.map(item => item[key])) : 0;

  return <div className="min-h-[calc(100vh-2rem)] space-y-5 bg-[#09070d] p-2 text-white sm:p-4 lg:p-6">
    <header className="rounded-3xl border border-violet-500/20 bg-[#100c19] p-6 shadow-2xl shadow-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-300"><Activity className="h-4 w-4" /> NIGHTOPS · ORDER PERFORMANCE</div><h1 className="mt-3 text-3xl font-semibold">ห้องประสิทธิภาพการดูดออเดอร์</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100/55">แยกจากห้องแชท เพื่อวิเคราะห์ Data Lookup, Parse และ Audit จากการสรุปออเดอร์จริง</p></div><Button variant="outline" onClick={() => query.refetch()} className="border-violet-400/20 bg-violet-400/5 text-violet-100"><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />รีเฟรช</Button></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([ ["เฉลี่ยรวม", avg("total"), "ms", Zap], ["เฉลี่ย Data Lookup", avg("dataLookup"), "ms", Database], ["สูงสุดรวม", max("total"), "ms", BarChart3], ["จำนวนครั้ง", rows.length, "ครั้ง", Activity] ] as const).map(([label, value, unit, Icon]) => <Card key={label} className="rounded-2xl border-violet-500/15 bg-[#100d15]"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-fuchsia-500/10 p-2.5 text-fuchsia-300"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-semibold text-white">{value.toLocaleString("th-TH")}<span className="ml-1 text-xs font-normal text-violet-100/40">{unit}</span></p><p className="text-xs text-violet-100/45">{label}</p></div></CardContent></Card>)}</div>
    <Card className="rounded-3xl border-violet-500/15 bg-[#100d15]"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base text-white">Timing ต่อรายการ</CardTitle><Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">ข้อมูลจริงจาก Audit Log</Badge></div></CardHeader><CardContent><div className="h-[320px] w-full">{query.isLoading ? <div className="flex h-full items-center justify-center text-sm text-violet-100/40">กำลังโหลด Timing…</div> : chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(196,181,253,0.12)" /><XAxis dataKey="name" tick={{ fill: "#c4b5fd", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} /><YAxis tick={{ fill: "#c4b5fd", fontSize: 10 }} unit="ms" /><Tooltip contentStyle={{ background: "#181020", border: "1px solid rgba(216,180,254,.25)", borderRadius: 12, color: "#fff" }} /><Bar dataKey="data" name="Data Lookup" fill="#a855f7" radius={[4, 4, 0, 0]} /><Bar dataKey="parse" name="Parse" fill="#22d3ee" radius={[4, 4, 0, 0]} /><Bar dataKey="total" name="รวม" fill="#f472b6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-violet-100/40">ยังไม่มีข้อมูลการสรุปออเดอร์</div>}</div></CardContent></Card>
    <Card className="rounded-3xl border-violet-500/15 bg-[#100d15]"><CardHeader><CardTitle className="text-base text-white">รายการ Timing ล่าสุด</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-violet-500/10 text-violet-100/35"><tr><th className="p-3">เวลา</th><th className="p-3">Order</th><th className="p-3">Page / Thread</th><th className="p-3">รวม</th><th className="p-3">Lookup</th><th className="p-3">Parse</th><th className="p-3">Audit</th></tr></thead><tbody>{rows.map(row => { const value = timing(row); return <tr key={row.id} className="border-b border-violet-500/[0.06] text-violet-50/75"><td className="p-3 text-violet-100/45">{new Date(row.createdAt).toLocaleString("th-TH")}</td><td className="p-3 font-medium text-fuchsia-200">{row.orderNumber || "draft"}</td><td className="max-w-56 truncate p-3 text-violet-100/45">{row.pageId || "—"} / {row.threadId || "—"}</td><td className="p-3 text-pink-200">{value.total}ms</td><td className="p-3 text-fuchsia-200">{value.dataLookup}ms</td><td className="p-3 text-cyan-200">{value.parse}ms</td><td className="p-3 text-amber-200">{value.audit}ms</td></tr>; })}</tbody></table></div></CardContent></Card>
  </div>;
}
