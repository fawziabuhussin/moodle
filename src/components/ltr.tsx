import type { ReactNode } from "react";
import type { Locale } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

export function Timestamp({
  value,
  locale,
  timeZone,
  className,
}: {
  value: Date | string;
  locale: Locale;
  timeZone: string;
  className?: string;
}) {
  const date = typeof value === "string" ? new Date(value) : value;
  return (
    <span className={className}>
      {formatDate(date, locale, timeZone)} <Ltr>{formatTime(date, timeZone)}</Ltr>
    </span>
  );
}
