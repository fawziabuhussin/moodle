import { useId, type CSSProperties } from "react";
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
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1",
          light ? "ring-white/20" : "ring-slate-200",
          compact ? "size-9" : "size-11",
        )}
      >
        <Image src="/logo.png" alt="انطلاقة אנטילאקה" width={compact ? 36 : 44} height={compact ? 36 : 44} priority className="size-full scale-[1.35] object-contain" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate font-bold tracking-tight", compact ? "text-[13px]" : "text-[15px]", light ? "text-white" : "text-slate-900")}>
          <span className="font-arabic">انطلاقة</span> אנטילאקה
        </span>
        <span className={cn("block truncate font-semibold text-orange-400", compact ? "text-[10px]" : "text-xs")}>جت المثلث - مركز شبابي</span>
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

/**
 * The signature graphic: three rising trajectories in the logo colours, each ending in a "head",
 * echoing the three figures of the logo and the meaning of the name (a launch).
 * Purely decorative.
 */
export function BrandArcs({ className, animated = false, muted = false }: { className?: string; animated?: boolean; muted?: boolean }) {
  const uid = `ea${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const arcs = [
    { d: "M18 212 C 70 206, 128 168, 152 70", color: "#1a8fd8", head: [152, 58], r: 11, dash: 260 },
    { d: "M44 222 C 104 214, 168 168, 196 44", color: "#84b82c", head: [197, 30], r: 12, dash: 280 },
    { d: "M80 230 C 144 222, 214 184, 238 92", color: "#f7891d", head: [240, 78], r: 11, dash: 250 },
  ] as const;
  return (
    <svg viewBox="0 0 260 240" fill="none" aria-hidden className={cn("pointer-events-none", className)}>
      <defs>
        {arcs.map((arc, index) => (
          <linearGradient key={arc.color} id={`${uid}-arc-${index}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={arc.color} stopOpacity="0" />
            <stop offset="0.55" stopColor={arc.color} stopOpacity={muted ? 0.35 : 0.85} />
            <stop offset="1" stopColor={arc.color} stopOpacity={muted ? 0.55 : 1} />
          </linearGradient>
        ))}
      </defs>
      {arcs.map((arc, index) => (
        <g key={arc.color}>
          <path
            d={arc.d}
            stroke={`url(#${uid}-arc-${index})`}
            strokeWidth={14 - index}
            strokeLinecap="round"
            className={animated ? "entilaka-draw" : undefined}
            style={animated ? ({ "--dash": arc.dash, animationDelay: `${index * 140}ms` } as CSSProperties) : undefined}
          />
          <circle
            cx={arc.head[0]}
            cy={arc.head[1]}
            r={arc.r}
            fill={arc.color}
            opacity={muted ? 0.55 : 1}
            className={animated ? "entilaka-float" : undefined}
            style={animated ? { animationDelay: `${index * 700}ms`, transformBox: "fill-box", transformOrigin: "center" } : undefined}
          />
        </g>
      ))}
      <path d="M210 20 c 10 6, 16 16, 14 30 c -12 -4, -18 -14, -14 -30 Z" fill="#84b82c" opacity={muted ? 0.35 : 0.75} />
      <path d="M226 36 c 12 2, 20 10, 22 22 c -12 0, -21 -8, -22 -22 Z" fill="#84b82c" opacity={muted ? 0.3 : 0.6} />
    </svg>
  );
}
