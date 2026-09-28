import Image from "next/image";
import Link from "next/link";

type MenuCardProps = { title: string; description: string; image: string; href: string };

export function MenuCard({ title, description, image, href }: MenuCardProps) {
  return (
    <Link href={href} className="group overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
      <Image src={`/assets/${image}`} alt={title} width={400} height={300} className="aspect-[1.35] w-full object-contain p-3 transition group-hover:scale-[1.02]" />
      <div className="min-h-24 border-t border-cyan-100 bg-cyan-50 px-4 py-3">
        <h3 className="font-semibold text-[#07547d]">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </Link>
  );
}
