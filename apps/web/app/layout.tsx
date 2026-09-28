import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "FMS | First Aid & Medicine Management System", description: "FMS healthcare workspace" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
