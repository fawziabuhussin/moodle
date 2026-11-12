import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ATTENDED: "bg-lime-50 text-lime-800 ring-lime-200 [--dot:var(--color-lime-500)]",
  LATE: "bg-orange-50 text-orange-800 ring-orange-200 [--dot:var(--color-orange-500)]",
  ABSENT: "bg-rose-50 text-rose-800 ring-rose-200 [--dot:var(--color-rose-500)]",
  EXCUSED: "bg-sky-50 text-sky-800 ring-sky-200 [--dot:var(--color-sky-500)]",
  PENDING: "bg-orange-50 text-orange-700 ring-orange-200 [--dot:var(--color-orange-500)]",
  APPROVED: "bg-sky-50 text-sky-800 ring-sky-200 [--dot:var(--color-sky-500)]",
  PAID: "bg-lime-50 text-lime-800 ring-lime-200 [--dot:var(--color-lime-500)]",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200 [--dot:var(--color-slate-400)]",
  SCHEDULED: "bg-sky-50 text-sky-800 ring-sky-200 [--dot:var(--color-sky-500)]",
  COMPLETED: "bg-lime-50 text-lime-800 ring-lime-200 [--dot:var(--color-lime-500)]",
  NO_SHOW: "bg-rose-50 text-rose-800 ring-rose-200 [--dot:var(--color-rose-500)]",
  NORMAL: "bg-slate-50 text-slate-700 ring-slate-200 [--dot:var(--color-slate-400)]",
  IMPORTANT: "bg-amber-50 text-amber-800 ring-amber-200 [--dot:var(--color-amber-500)]",
  URGENT: "bg-rose-50 text-rose-800 ring-rose-200 [--dot:var(--color-rose-500)]",
  MANUAL: "bg-slate-50 text-slate-700 ring-slate-200 [--dot:var(--color-slate-400)]",
  TERMINAL_MACHINE: "bg-lime-50 text-lime-800 ring-lime-200 [--dot:var(--color-lime-500)]",
  KIOSK: "bg-sky-50 text-sky-800 ring-sky-200 [--dot:var(--color-sky-500)]",
};

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const known = tones[tone ?? ""];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        known ?? "bg-secondary text-secondary-foreground ring-slate-200",
        className,
      )}
    >
      {known ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--dot)]" /> : null}
      {children}
    </span>
  );
}
