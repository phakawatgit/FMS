"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { DashboardPreview } from "../components/dashboard/DashboardPreview";
import { MenuCard } from "../components/dashboard/MenuCard";
import { getApiOverview } from "../lib/api";

const cards = [["Dashboard and Report", "แดชบอร์ดและรายงาน", "5.png", "/legacy/dashboard.html"], ["Infirmary Visit", "บันทึกการเข้าห้องพยาบาล", "6.png", "/legacy/infirmary-visit.html"], ["Stock", "คลังยาและเวชภัณฑ์", "7.png", "/legacy/stock.html"], ["Catalog", "แคตตาล็อกการสั่งซื้อ", "8.png", "/legacy/catalog.html"], ["Borrow and Return", "ระบบการยืม-คืน", "9.png", "/legacy/borrow-return.html"], ["Duty Shift", "ระบบการเข้าเวร", "10.png", "/legacy/duty-shift.html"], ["System Activity Log", "ประวัติกิจกรรมระบบ", "11.png", "/legacy/system-activity.html"]] as const;

export default function Home() {
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [counts, setCounts] = useState({ users: 0, dutyShifts: 0 });
  const thai = language === "th";

  useEffect(() => {
    getApiOverview()
      .then((result) => {
        setApiStatus(result.data?.database === "connected" ? "connected" : "disconnected");
        if (result.data?.counts) setCounts(result.data.counts);
      })
      .catch(() => setApiStatus("disconnected"));
  }, []);

  return <main className="min-h-screen">
    <AppHeader language={language} onLanguageChange={() => setLanguage(thai ? "en" : "th")} />
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      <DashboardPreview thai={thai} />
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-cyan-700">{thai ? "ระบบจัดการ" : "Management system"}</p><h2 className="text-3xl font-bold text-[#07547d]">{thai ? "เมนู" : "Menu"}</h2></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-sm shadow-sm ${apiStatus === "connected" ? "bg-emerald-100 text-emerald-700" : apiStatus === "loading" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{apiStatus === "connected" ? (thai ? "เชื่อมต่อระบบแล้ว" : "API connected") : apiStatus === "loading" ? (thai ? "กำลังเชื่อมต่อ..." : "Connecting...") : (thai ? "ยังไม่เชื่อมต่อ API" : "API disconnected")}</span><span className="rounded-full bg-white px-3 py-1 text-sm text-slate-500 shadow-sm">{cards.length} {thai ? "รายการ" : "items"}</span></div></div>
        {apiStatus === "connected" && <p className="mb-4 text-sm text-slate-500">{thai ? `ผู้ใช้ ${counts.users} คน · ตารางเวร ${counts.dutyShifts} รายการ` : `${counts.users} users · ${counts.dutyShifts} duty shifts`}</p>}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([title, description, image, href]) => <MenuCard key={image} title={thai ? description : title} description={thai ? title : description} image={image} href={href} />)}</div>
      </section>
    </div>
  </main>;
}
