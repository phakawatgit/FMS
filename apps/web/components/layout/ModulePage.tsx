import Link from "next/link";

type ModulePageProps = { title: string; description: string };

export function ModulePage({ title, description }: ModulePageProps) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#07547d] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          ← กลับหน้าเมนู
        </Link>
        <section className="mt-6 rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">FMS module</p>
          <h1 className="mt-2 text-3xl font-bold text-[#07547d] sm:text-4xl">{title}</h1>
          <p className="mt-3 text-slate-600">{description}</p>
          <div className="mt-8 rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/60 p-8 text-center text-slate-500">
            หน้านี้พร้อมสำหรับเชื่อมข้อมูลจาก Backend และ PostgreSQL
          </div>
        </section>
      </div>
    </main>
  );
}
