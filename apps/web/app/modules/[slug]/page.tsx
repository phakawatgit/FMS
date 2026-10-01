import { notFound } from "next/navigation";
import Workspace from "../../../components/modules/Workspace";

const modules: Record<string, { title: string; description: string }> = {
  settings: { title: "Settings", description: "???????????????" },
  dashboard: { title: "Dashboard and Report", description: "แดชบอร์ดและรายงานของระบบ" },
  "infirmary-visit": { title: "Infirmary Visit", description: "บันทึกการเข้าห้องพยาบาล" },
  stock: { title: "Stock", description: "คลังยาและเวชภัณฑ์" },
  catalog: { title: "Catalog", description: "แคตตาล็อกการสั่งซื้อ" },
  "borrow-return": { title: "Borrow and Return", description: "ระบบการยืม-คืน" },
  "duty-shift": { title: "Duty Shift", description: "ระบบการเข้าเวร" },
  activity: { title: "System Activity Log", description: "ประวัติกิจกรรมระบบ" },
};

export default async function ModuleRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const module = modules[slug];
  if (!module) notFound();
  return <Workspace slug={slug} />;
}
