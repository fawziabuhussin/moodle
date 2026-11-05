import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  size = "md",
  tone = "dark",
  className,
}: {
  size?: "sm" | "md";
  tone?: "dark" | "light";
  className?: string;
}) {
  const light = tone === "light";
  const compact = size === "sm";
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="انطلاقة אנטילאקה"
        width={compact ? 36 : 40}
        height={compact ? 36 : 40}
        priority
        className={cn("shrink-0 rounded-lg bg-white object-contain", compact ? "size-9" : "size-10")}
      />
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate font-semibold", compact ? "text-[13px]" : "text-sm", light ? "text-white" : "text-slate-900")}>
          <span className="font-arabic">انطلاقة</span> אנטילאקה
        </span>
        <span className={cn("block truncate font-medium text-orange-400", compact ? "text-[10px]" : "text-xs")}>جت المثلث - مركز شبابي</span>
      </span>
    </div>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-3xl bg-white", className)}>
      <Image src="/logo.png" alt="انطلاقة אנטילאקה" fill sizes="220px" className="object-contain" priority />
    </span>
  );
}
