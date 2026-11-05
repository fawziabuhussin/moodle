import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabLinks({ tabs, current }: { tabs: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-secondary p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn("rounded-xl px-3 py-1.5 text-sm whitespace-nowrap", current === tab.key ? "bg-card shadow-sm" : "text-muted-foreground")}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
