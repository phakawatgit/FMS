"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setMessage("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    // เชื่อม endpoint authentication ของ Express ได้ในขั้นถัดไป
    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-cyan-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">FMS account</p>
          <h1 className="mt-2 text-3xl font-bold text-[#07547d]">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-slate-500">First Aid &amp; Medicine Management System</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            อีเมล
            <input className="mt-1.5 w-full rounded-xl border border-cyan-200 bg-cyan-50/30 px-3 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            รหัสผ่าน
            <input className="mt-1.5 w-full rounded-xl border border-cyan-200 bg-cyan-50/30 px-3 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่าน" autoComplete="current-password" />
          </label>
          {message && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{message}</p>}
          <button className="w-full rounded-xl bg-[#07547d] px-4 py-3 font-semibold text-white transition hover:bg-[#064665] focus:outline-none focus:ring-2 focus:ring-cyan-400" type="submit">เข้าสู่ระบบ</button>
        </form>
        <Link href="/" className="mt-5 block text-center text-sm font-semibold text-cyan-700 hover:underline">กลับหน้าเมนู</Link>
      </section>
    </main>
  );
}
