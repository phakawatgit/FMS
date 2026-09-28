import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400 ${className}`} {...props} />;
}
