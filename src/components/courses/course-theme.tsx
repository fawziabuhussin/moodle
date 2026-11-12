import type { ReactNode } from "react";
import { BookOpen, Brain, Code2, HandHeart, Languages, Presentation, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CourseAccent = {
  /** Gradient for covers and icon tiles. */
  cover: string;
  /** Soft tinted surface. */
  soft: string;
  /** Text colour on light surfaces. */
  text: string;
  /** Solid fill for bars and dots. */
  bar: string;
  /** Glow colour behind the dark hero. */
  glow: string;
};

const ACCENTS: CourseAccent[] = [
  { cover: "from-sky-400 via-sky-600 to-sky-800", soft: "bg-sky-50 ring-sky-100", text: "text-sky-700", bar: "bg-sky-500", glow: "bg-sky-500/30" },
  { cover: "from-lime-400 via-lime-600 to-emerald-700", soft: "bg-lime-50 ring-lime-100", text: "text-lime-700", bar: "bg-lime-500", glow: "bg-lime-400/25" },
  { cover: "from-orange-300 via-orange-500 to-rose-600", soft: "bg-orange-50 ring-orange-100", text: "text-orange-700", bar: "bg-orange-500", glow: "bg-orange-500/25" },
  { cover: "from-indigo-400 via-indigo-600 to-violet-800", soft: "bg-indigo-50 ring-indigo-100", text: "text-indigo-700", bar: "bg-indigo-500", glow: "bg-indigo-500/30" },
  { cover: "from-teal-300 via-teal-500 to-cyan-700", soft: "bg-teal-50 ring-teal-100", text: "text-teal-700", bar: "bg-teal-500", glow: "bg-teal-400/25" },
  { cover: "from-fuchsia-400 via-violet-500 to-indigo-700", soft: "bg-violet-50 ring-violet-100", text: "text-violet-700", bar: "bg-violet-500", glow: "bg-violet-500/30" },
];

function hash(value: string) {
  let h = 0;
  for (let index = 0; index < value.length; index += 1) h = (h * 31 + value.charCodeAt(index)) >>> 0;
  return h;
}

/** Subject keywords decide the icon and, when known, a fixed brand colour; anything else gets a stable colour from its code. */
export function courseTheme(code: string, title = ""): { accent: CourseAccent; Icon: LucideIcon } {
  const key = `${code} ${title}`.toLowerCase();
  if (/psy|פסיכו|سيكو|بسيخو/.test(key)) return { accent: ACCENTS[0], Icon: Brain };
  if (/py|ai\b|code|תכנ|برمج|بايثون/.test(key)) return { accent: ACCENTS[1], Icon: Code2 };
  if (/heb|עבר|عبري|lang|eng|אנגל/.test(key)) return { accent: ACCENTS[3], Icon: Languages };
  if (/vol|התנדב|تطوع/.test(key)) return { accent: ACCENTS[2], Icon: HandHeart };
  if (/lead|מנהיג|قياد|זהות|هوي/.test(key)) return { accent: ACCENTS[4], Icon: Sparkles };
  if (/work|סדנ|ورش/.test(key)) return { accent: ACCENTS[5], Icon: Presentation };
  return { accent: ACCENTS[hash(code) % ACCENTS.length], Icon: BookOpen };
}

/** Share of the course calendar that has passed, or null when dates are missing. Computed on the server. */
export function courseProgress(start: Date | null, end: Date | null, now = new Date()) {
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-sky-600 to-lime-500 text-xs font-bold text-white ring-2 ring-white",
        className,
      )}
    >
      {letters || "•"}
    </span>
  );
}

export function EmptyPanel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="bg-dots-dark grid place-items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="size-6" />
      </span>
      <p className="max-w-xs text-sm text-slate-500">{children}</p>
    </div>
  );
}

export function PanelTitle({ icon: Icon, children, tone = "from-sky-400 to-sky-600" }: { icon: LucideIcon; children: ReactNode; tone?: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm", tone)}>
        <Icon className="size-4" />
      </span>
      {children}
    </h2>
  );
}
