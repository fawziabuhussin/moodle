import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabLinks({ tabs, current }: { tabs: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-xs backdrop-blur">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn("rounded-xl px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors", current === tab.key ? "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(13_114_184/0.6)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
