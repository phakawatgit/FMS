type DashboardPreviewProps = { thai: boolean };

export function DashboardPreview({ thai }: DashboardPreviewProps) {
  const weekdays = thai ? ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <section className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">{thai ? "วันนี้" : "Today"}</p>
          <h1 className="mt-1 text-3xl font-bold text-[#07547d]">{thai ? "การเข้าเวร" : "Duty shift"}</h1>
          <p className="mt-1 text-lg font-semibold text-cyan-600">{new Intl.DateTimeFormat(thai ? "th-TH" : "en-US", { month: "long", year: "numeric" }).format(new Date())}</p>
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold">{weekdays.map((day) => <span key={day} className="rounded-lg bg-[#07547d] px-1 py-2 text-white">{day}</span>)}</div>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
          <h2 className="font-semibold text-[#07547d]">{thai ? "เลือกแถบสี" : "Choose a color"}</h2>
          <div className="mt-3 grid grid-cols-5 gap-2">{Array.from({ length: 20 }, (_, index) => <span key={index} className="aspect-square rounded-lg border border-white shadow-sm" style={{ backgroundColor: `hsl(${index * 18} 68% 78%)` }} />)}</div>
        </div>
      </div>
    </section>
  );
}
