"use client";

import Image from "next/image";
import { LogOut, Languages } from "lucide-react";
import { Button } from "../ui/button";

type AppHeaderProps = { language: "th" | "en"; onLanguageChange: () => void };

export function AppHeader({ language, onLanguageChange }: AppHeaderProps) {
  const thai = language === "th";
  return (
    <header className="sticky top-0 z-20 border-b border-white/20 bg-[#07547d]/95 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-8 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/assets/fms.png" alt="FMS" width={42} height={42} className="shrink-0 rounded-xl" />
          <span className="max-w-[46vw] truncate text-xs font-semibold tracking-wide sm:max-w-none sm:text-base">First Aid &amp; Medicine Management System</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" aria-label={thai ? "เปลี่ยนเป็นภาษาอังกฤษ" : "เปลี่ยนเป็นภาษาไทย"} onClick={onLanguageChange} className="gap-1.5 border border-white/70 bg-white px-2.5 py-2 text-xs text-[#07547d] hover:bg-cyan-50 sm:px-3">
            <Languages size={15} aria-hidden="true" /> {thai ? "ไทย" : "English"}
          </Button>
          <Button type="button" className="hidden gap-1.5 border border-white/50 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20 sm:inline-flex">
            <LogOut size={14} aria-hidden="true" /> {thai ? "ออกจากระบบ" : "Log out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
