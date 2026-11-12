"use client";

import { ArrowUpRight, BookOpen, CalendarRange, GraduationCap, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { courseTheme, EmptyPanel } from "@/components/courses/course-theme";
import { Ltr } from "@/components/ltr";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CatalogCourse = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  students: number;
  teachers: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
};

type Filter = "all" | "active" | "inactive";

export function CoursesCatalog({
  courses,
  searchLabel,
  studentsLabel,
  teachersLabel,
  inactiveLabel,
  activeLabel,
  allLabel,
  coursesLabel,
  emptyLabel,
}: {
  courses: CatalogCourse[];
  searchLabel: string;
  studentsLabel: string;
  teachersLabel: string;
  inactiveLabel: string;
  activeLabel: string;
  allLabel: string;
  coursesLabel: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const activeCount = courses.filter((course) => course.active).length;
  const enrolled = courses.reduce((sum, course) => sum + course.students, 0);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses
      .filter((course) => (filter === "all" ? true : filter === "active" ? course.active : !course.active))
      .filter((course) => !needle || `${course.code} ${course.title} ${course.description ?? ""}`.toLowerCase().includes(needle));
  }, [courses, query, filter]);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: allLabel, count: courses.length },
    { key: "active", label: activeLabel, count: activeCount },
    { key: "inactive", label: inactiveLabel, count: courses.length - activeCount },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat icon={BookOpen} tone="from-sky-400 to-sky-600" label={coursesLabel} value={courses.length} />
        <Stat icon={GraduationCap} tone="from-lime-400 to-lime-600" label={activeLabel} value={activeCount} />
        <Stat icon={Users} tone="from-orange-400 to-orange-600" label={studentsLabel} value={enrolled} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <Search aria-hidden className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} aria-label={searchLabel} className="h-11 rounded-2xl ps-10" />
        </label>
        <div className="flex gap-1 self-start rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-xs backdrop-blur sm:self-auto">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors",
                filter === item.key ? "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(13_114_184/0.6)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
              )}
            >
              {item.label}
              <Ltr className={cn("rounded-full px-1.5 text-[11px] font-bold", filter === item.key ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{item.count}</Ltr>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? <EmptyPanel icon={BookOpen}>{emptyLabel}</EmptyPanel> : null}

      <div className="entilaka-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((course) => {
          const { accent, Icon } = courseTheme(course.code, course.title);
          const span = [course.startDate, course.endDate].filter(Boolean).join(" – ");
          return (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className={cn(
                "group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                !course.active && "opacity-75 saturate-50 hover:opacity-100 hover:saturate-100",
              )}
            >
              <span className={cn("relative isolate block h-32 overflow-hidden bg-gradient-to-br", accent.cover)}>
                <span aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-60" />
                <span aria-hidden className="absolute -end-8 -bottom-12 -z-10 size-40 rounded-full bg-white/15 blur-sm" />
                <span aria-hidden className="absolute end-10 -top-10 -z-10 size-24 rounded-full bg-white/10" />
                <Icon aria-hidden className="absolute -bottom-5 end-4 size-28 text-white/20 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" strokeWidth={1.4} />
                <span className="absolute start-4 top-4 flex items-center gap-2">
                  <span className="grid size-10 place-items-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur">
                    <Icon className="size-5" />
                  </span>
                  <Ltr className="rounded-lg bg-black/25 px-2 py-1 text-[11px] font-bold tracking-wider text-white backdrop-blur">{course.code}</Ltr>
                </span>
                {course.active ? null : (
                  <span className="absolute end-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-rose-700">{inactiveLabel}</span>
                )}
              </span>
              <span className="flex flex-1 flex-col p-4 md:p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-lg leading-snug font-bold text-slate-900">{course.title}</span>
                  <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600 rtl:-scale-x-100" />
                </span>
                {course.description ? <span className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</span> : null}
                <span className="mt-auto grid gap-3 pt-5">
                  {course.progress != null ? (
                    <span className="grid gap-1.5">
                      <span className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1"><CalendarRange className="size-3.5" /><Ltr>{span}</Ltr></span>
                        <Ltr className={accent.text}>{course.progress}%</Ltr>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className={cn("block h-full rounded-full", accent.bar)} style={{ width: `${Math.max(course.progress, 3)}%` }} />
                      </span>
                    </span>
                  ) : span ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><CalendarRange className="size-3.5" /><Ltr>{span}</Ltr></span>
                  ) : null}
                  <span className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ring-1", accent.soft, accent.text)}>
                      <Users className="size-3.5" /><Ltr>{course.students}</Ltr> {studentsLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200/70">
                      <GraduationCap className="size-3.5" /><Ltr>{course.teachers}</Ltr> {teachersLabel}
                    </span>
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: typeof BookOpen; tone: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm md:p-4">
      <span className={cn("hidden size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm sm:grid", tone)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold text-slate-500 md:text-xs">{label}</span>
        <Ltr className="block text-xl font-extrabold text-slate-900 md:text-2xl">{value}</Ltr>
      </span>
    </div>
  );
}
