"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Input } from "@/components/ui/input";

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
};

export function CoursesCatalog({
  courses,
  searchLabel,
  studentsLabel,
  teachersLabel,
  inactiveLabel,
  emptyLabel,
}: {
  courses: CatalogCourse[];
  searchLabel: string;
  studentsLabel: string;
  teachersLabel: string;
  inactiveLabel: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return courses;
    return courses.filter((course) => `${course.code} ${course.title} ${course.description ?? ""}`.toLowerCase().includes(needle));
  }, [courses, query]);

  return (
    <div className="grid gap-4">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} className="max-w-md bg-white" />
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((course) => {
          const span = [course.startDate, course.endDate].filter(Boolean).join(" – ");
          return (
            <Link key={course.id} href={`/courses/${course.id}`} className="group flex min-h-44 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
              <span className="h-1.5 bg-gradient-to-l from-sky-700 via-sky-500 to-amber-400" />
              <span className="flex flex-1 flex-col p-4">
                <span className="flex items-center justify-between gap-2">
                  <Ltr className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">{course.code}</Ltr>
                  {course.active ? null : <span className="text-xs text-rose-700">{inactiveLabel}</span>}
                </span>
                <span className="mt-3 text-lg font-semibold leading-snug text-slate-950">{course.title}</span>
                <span className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description || "\u00a0"}</span>
                <span className="mt-auto flex items-end justify-between gap-3 pt-4 text-xs text-slate-500">
                  <Ltr>{span || "—"}</Ltr>
                  <span className="text-end">{course.students} {studentsLabel} · {course.teachers} {teachersLabel}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
