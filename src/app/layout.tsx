import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Almarai, Cairo, Heebo, Inter } from "next/font/google";
import { getLocale } from "@/lib/auth";
import { direction } from "@/lib/constants";
import "./globals.css";

const heebo = Heebo({ subsets: ["latin", "hebrew"], variable: "--font-heebo", display: "swap" });
const cairo = Cairo({ subsets: ["latin", "arabic"], variable: "--font-cairo", display: "swap" });
const almarai = Almarai({ subsets: ["arabic", "latin"], weight: ["400", "700", "800"], variable: "--font-almarai", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "انطلاقة אנטילאקה",
  description: "جت المثلث - مركز شبابي. Entilaka learning, attendance, stipends, and course communication.",
  applicationName: "انطلاقة אנטילאקה",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  appleWebApp: { capable: true, title: "انطلاقة", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={direction(locale)} className={`${heebo.variable} ${cairo.variable} ${almarai.variable} ${inter.variable} h-full`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
