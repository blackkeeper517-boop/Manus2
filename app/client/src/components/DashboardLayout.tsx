import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, Archive, Bell, Boxes, CalendarDays, Database, LayoutDashboard, LogOut, MessageCircle, PanelLeft, Tags } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { PRESENTATION_MODE } from "@shared/presentation";

const menuItems = [
  { icon: LayoutDashboard, label: "Order Control", path: "/orders" },
  { icon: Boxes, label: "แยก 1/2/3 คอต", path: "/order-buckets" },
  { icon: MessageCircle, label: "รวมแชทเพจ", path: "/chats" },
  { icon: Archive, label: "ประวัติออเดอร์", path: "/order-history" },
  { icon: CalendarDays, label: "สรุปออเดอร์รายวัน", path: "/daily-chat-summary" },
  { icon: Activity, label: "ประสิทธิภาพดูดออเดอร์", path: "/order-performance" },
  { icon: Boxes, label: "เช็กสต๊อก / เติมสต๊อก", path: "/stock-room" },
  { icon: Tags, label: "Dashboard Mapping", path: "/mapping-dashboard" },
  { icon: Tags, label: "Alias สินค้า", path: "/aliases" },
  { icon: Database, label: "คลังโปรเจกต์", path: "/" },
];
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading && !PRESENTATION_MODE) return <DashboardLayoutSkeleton />;
  if (!user && !PRESENTATION_MODE) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <div className="rounded-2xl bg-cyan-50 p-4 text-cyan-700"><Database className="h-8 w-8" /></div>
          <div><h1 className="text-2xl font-semibold tracking-tight">เข้าสู่คลังโปรเจกต์</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">พื้นที่นี้เก็บ SQL, โค้ด และ workflow สำคัญของคุณ กรุณาเข้าสู่ระบบเพื่อใช้งาน</p></div>
          <Button onClick={() => startLogin()} size="lg" className="w-full rounded-xl bg-slate-900 shadow-lg hover:bg-slate-800">เข้าสู่ระบบ</Button>
        </div>
      </div>
    );
  }

  return <SidebarProvider className="bg-[#09070d] text-white" style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const threadsQuery = trpc.orders.threads.useQuery(undefined, { refetchInterval: 15_000 });
  const deliveryQuery = trpc.chat.deliveryHealth.useQuery(undefined, { refetchInterval: 15_000, enabled: user?.role === "admin" });
  const unreadThreads = (threadsQuery.data ?? []).filter(thread => thread.unread);
  const lastNotificationKeyRef = useRef("");
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const key = unreadThreads.map(thread => `${thread.key}:${thread.latestAt ?? ""}`).join("|");
    if (!key || !lastNotificationKeyRef.current) { lastNotificationKeyRef.current = key; return; }
    if (key === lastNotificationKeyRef.current) return;
    lastNotificationKeyRef.current = key;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const newest = unreadThreads[0];
      new Notification("NIGHTOPS · ลูกค้าทักใหม่", { body: `${newest?.customerName || "ลูกค้า"} ส่งข้อความใหม่เข้ามา` });
    }
  }, [unreadThreads]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar collapsible="icon" className="border-r border-violet-500/10 bg-[#0d0a12] text-violet-50 [&_[data-slot=sidebar-inner]]:bg-[#0d0a12] [&_[data-slot=sidebar-inner]]:text-violet-50" disableTransition={isResizing}>
        <SidebarHeader className="h-16 justify-center"><div className="flex w-full items-center gap-3 px-2"><button onClick={toggleSidebar} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-violet-200/60 hover:bg-violet-500/10 hover:text-fuchsia-200" aria-label="เปิดหรือปิดเมนู"><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <div className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold tracking-tight text-violet-50">NIGHTOPS</span></div>}</div></SidebarHeader>
        <SidebarContent className="gap-0"><SidebarMenu className="px-2 py-1">{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 font-normal text-violet-100/55 hover:bg-violet-500/10 hover:text-violet-50 data-[active=true]:bg-fuchsia-500/10 data-[active=true]:text-fuchsia-200"><item.icon className={`h-4 w-4 ${location === item.path ? "text-fuchsia-300" : ""}`} /><span>{item.label}</span>{item.path === "/chats" && unreadThreads.length > 0 ? <span className="ml-auto rounded-full bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-300">{unreadThreads.length}</span> : null}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><div className="mx-3 my-2 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-2.5"><button type="button" onClick={() => { setLocation("/chats"); if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); }} className="flex w-full items-center gap-2 text-left text-xs text-red-200"><Bell className="h-3.5 w-3.5" /><span>{unreadThreads.length ? `ลูกค้าทักใหม่ ${unreadThreads.length} ห้อง` : "การแจ้งเตือนข้อความ"}</span></button></div></SidebarContent>
        <SidebarFooter className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="group flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-violet-500/10"><Avatar className="h-9 w-9 shrink-0 border border-violet-400/20 bg-violet-500/10"><AvatarFallback className="bg-transparent text-xs font-medium text-fuchsia-200">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium leading-none text-violet-50">{user?.name || "-"}</p><p className="mt-1.5 truncate text-xs text-violet-100/35">{user?.email || "-"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 border-violet-500/20 bg-[#161020] text-violet-50"><DropdownMenuItem onClick={logout} className="cursor-pointer text-red-300 focus:bg-red-500/10 focus:text-red-200"><LogOut className="mr-2 h-4 w-4" /><span>ออกจากระบบ</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`} style={{ zIndex: 50 }} onMouseDown={() => !isCollapsed && setIsResizing(true)} />
    </div>
    <SidebarInset className="bg-[#09070d]">{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-violet-500/10 bg-[#0d0a12]/95 px-2 backdrop-blur"><div className="flex items-center gap-2"><SidebarTrigger className="h-9 w-9 rounded-lg text-violet-100 hover:bg-violet-500/10" /><span className="text-violet-50">{activeMenuItem?.label ?? "เมนู"}</span></div></div>}<div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-500/15 bg-[#100c19] px-3 py-2 text-[11px] text-violet-100/60"><button type="button" onClick={() => setLocation("/chats")} className="inline-flex items-center gap-1.5 text-red-200 hover:text-red-100"><Bell className="h-3.5 w-3.5" />{unreadThreads.length ? `ลูกค้าทักใหม่ ${unreadThreads.length} ห้อง` : "ไม่มีข้อความใหม่"}</button><span className="text-violet-100/20">·</span><span className={deliveryQuery.data?.failed.length ? "text-red-300" : "text-emerald-300"}>Meta API: {deliveryQuery.data?.failed.length ? `มีส่งไม่สำเร็จ ${deliveryQuery.data.failed.length}` : "พร้อมใช้งาน"}</span><span className="text-violet-100/35">ส่งแล้ว {deliveryQuery.data?.sent.length ?? 0}</span><span className="ml-auto text-violet-100/30">Live 15s</span></div><main className="flex-1 p-4">{children}</main></SidebarInset>
  </>;
}
