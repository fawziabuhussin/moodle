import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ATTENDED: "bg-lime-100 text-lime-800",
  LATE: "bg-orange-100 text-orange-800",
  ABSENT: "bg-rose-100 text-rose-800",
  EXCUSED: "bg-sky-100 text-sky-800",
  PENDING: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  APPROVED: "bg-sky-100 text-sky-800",
  PAID: "bg-lime-100 text-lime-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  SCHEDULED: "bg-sky-100 text-sky-800",
  COMPLETED: "bg-lime-100 text-lime-800",
  NO_SHOW: "bg-rose-100 text-rose-800",
  NORMAL: "bg-slate-100 text-slate-700",
  IMPORTANT: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  URGENT: "bg-rose-100 text-rose-800",
  MANUAL: "bg-slate-100 text-slate-700",
  TERMINAL_MACHINE: "bg-lime-100 text-lime-800",
  KIOSK: "bg-sky-100 text-sky-800",
};

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone ?? ""] ?? "bg-secondary text-secondary-foreground", className)}>
      {children}
    </span>
  );
}
