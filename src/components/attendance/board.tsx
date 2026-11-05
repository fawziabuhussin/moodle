"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Clock, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { fill } from "@/lib/i18n";
import { parseHm } from "@/lib/time";
import { cn, fullName, initials } from "@/lib/utils";
import {
  clearAttendanceTimesAction,
  markAllAttendedAction,
  saveAttendanceStatusAction,
  saveAttendanceTimesAction,
} from "@/server/actions/attendance";

const STATUSES = ["ATTENDED", "LATE", "ABSENT", "EXCUSED"] as const;
type Status = (typeof STATUSES)[number];
type StatusFilter = "ALL" | Status | "UNMARKED";

export type AttendanceStudent = {
  id: string;
  firstName: string;
  lastName: string;
  badge: string | null;
  status: Status | null;
  checkIn: string | null;
  checkOut: string | null;
  minutesLate: number | null;
  totalMinutes: number | null;
};

export type AttendanceLabels = {
  search: string;
  all: string;
  unmarked: string;
  attended: string;
  late: string;
  absent: string;
  excused: string;
  markAll: string;
  marked: string;
  present: string;
  lateCount: string;
  absentCount: string;
  addHours: string;
  checkIn: string;
  checkOut: string;
  now: string;
  officialStart: string;
  plusTwo: string;
  save: string;
  clearTimes: string;
  lateTag: string;
  hoursTitle: string;
  close: string;
  noStudents: string;
  noMatches: string;
  saved: string;
  invalid: string;
  date: string;
  course: string;
  allStudents: string;
  student: string;
  status: string;
  hours: string;
  previous: string;
  today: string;
  next: string;
};

const statusClass: Record<Status, string> = {
  ATTENDED: "bg-lime-600 text-white",
  LATE: "bg-orange-500 text-white",
  ABSENT: "bg-rose-600 text-white",
  EXCUSED: "bg-slate-600 text-white",
};

const statusIdle: Record<Status, string> = {
  ATTENDED: "text-lime-800 hover:bg-lime-100",
  LATE: "text-orange-800 hover:bg-orange-100",
  ABSENT: "text-rose-800 hover:bg-rose-100",
  EXCUSED: "text-slate-600 hover:bg-slate-200",
};

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function todayIso(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function fromMinutes(total: number) {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

function durationLabel(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

function nowHm(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

function previewTimes(checkIn: string, checkOut: string, cutoff: number) {
  const arrival = parseHm(checkIn);
  if (arrival == null) return { invalid: true as const };
  const end = checkOut ? parseHm(checkOut) : null;
  if (checkOut && end == null) return { invalid: true as const };
  if (end != null && end < arrival) return { invalid: true as const };
  const status: Status = arrival <= cutoff ? "ATTENDED" : "LATE";
  return {
    invalid: false as const,
    status,
    minutesLate: status === "LATE" ? arrival - cutoff : 0,
    totalMinutes: end == null ? null : end - arrival,
  };
}

export function AttendanceBoard({
  students,
  courses,
  date,
  courseId,
  officialStart,
  graceMinutes,
  timeZone,
  labels,
  pathname = "/attendance",
  hideCourseSelect = false,
}: {
  students: AttendanceStudent[];
  courses: { id: string; title: string }[];
  date: string;
  courseId: string;
  officialStart: string;
  graceMinutes: number;
  timeZone: string;
  labels: AttendanceLabels;
  pathname?: string;
  hideCourseSelect?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(students);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toastTimer = useRef<number | null>(null);
  const signature = students.map((student) => `${student.id}:${student.status}:${student.checkIn}:${student.checkOut}:${student.totalMinutes}`).join("|");

  useEffect(() => {
    setRows(students);
  }, [signature, students]);

  const cutoff = (parseHm(officialStart) ?? 16 * 60) + Math.max(0, graceMinutes);
  const statusLabel: Record<Status, string> = {
    ATTENDED: labels.attended,
    LATE: labels.late,
    ABSENT: labels.absent,
    EXCUSED: labels.excused,
  };

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }

  function visit(next: { date?: string; courseId?: string }) {
    const params = new URLSearchParams();
    if (pathname.startsWith("/courses/")) {
      params.set("tab", "attendance");
      params.set("date", next.date ?? date);
    } else {
      params.set("date", next.date ?? date);
      const course = next.courseId ?? courseId;
      if (course) params.set("courseId", course);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((student) => {
      if (filter === "UNMARKED" && student.status) return false;
      if (filter !== "ALL" && filter !== "UNMARKED" && student.status !== filter) return false;
      if (!needle) return true;
      const haystack = `${student.firstName} ${student.lastName} ${student.badge ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, query, filter]);

  const counts = {
    ALL: rows.length,
    ATTENDED: rows.filter((student) => student.status === "ATTENDED").length,
    LATE: rows.filter((student) => student.status === "LATE").length,
    ABSENT: rows.filter((student) => student.status === "ABSENT").length,
    EXCUSED: rows.filter((student) => student.status === "EXCUSED").length,
  };
  const today = todayIso(timeZone);

  async function setStatus(student: AttendanceStudent, status: Status) {
    const previous = student.status;
    if (previous === status) return;
    setRows((current) => current.map((row) => (row.id === student.id ? { ...row, status } : row)));
    setPendingId(student.id);
    const formData = new FormData();
    formData.set("userId", student.id);
    formData.set("date", date);
    formData.set("courseId", courseId);
    formData.set("status", status);
    const result = await saveAttendanceStatusAction(null, formData);
    setPendingId(null);
    if (result?.error) {
      setRows((current) => current.map((row) => (row.id === student.id ? { ...row, status: previous } : row)));
      flash(result.error);
      return;
    }
    flash(labels.saved);
    startTransition(() => router.refresh());
  }

  async function markVisibleAttended() {
    const targets = visible.filter((student) => student.status !== "ATTENDED");
    if (targets.length === 0) return;
    const previous = rows;
    const ids = new Set(targets.map((student) => student.id));
    setRows((current) => current.map((row) => (ids.has(row.id) ? { ...row, status: "ATTENDED" } : row)));
    setMarking(true);
    const formData = new FormData();
    formData.set("date", date);
    formData.set("courseId", courseId);
    for (const student of targets) formData.append("userId", student.id);
    const result = await markAllAttendedAction(null, formData);
    setMarking(false);
    if (result?.error || !result?.success) {
      setRows(previous);
      flash(result?.error ?? labels.invalid);
      return;
    }
    flash(fill(labels.marked, { n: result.success }));
    startTransition(() => router.refresh());
  }

  const editingStudent = rows.find((student) => student.id === editing) ?? null;

  return (
    <div>
      <div className={cn("sticky top-16 z-20 -mx-4 mb-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-2 shadow-sm backdrop-blur md:-mx-8 md:px-8", isPending && "opacity-80")}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 lg:w-52">
            <span className="sr-only">{labels.search}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="h-9 ps-9" />
          </label>
          {hideCourseSelect ? null : (
            <label className="min-w-0 lg:w-56">
              <span className="sr-only">{labels.course}</span>
              <Select value={courseId} onChange={(event) => visit({ courseId: event.target.value })} className="h-9">
                <option value="">{labels.allStudents}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </Select>
            </label>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <button type="button" onClick={() => visit({ date: shiftIso(date, -1) })} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <ChevronLeft className="size-3.5 rtl:rotate-180" />
              {labels.previous}
            </button>
            <label className="w-[148px]">
              <span className="sr-only">{labels.date}</span>
              <Input type="date" value={date} onChange={(event) => visit({ date: event.target.value })} className="h-9" />
            </label>
            <button type="button" onClick={() => visit({ date: today })} disabled={date === today} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-primary shadow-sm hover:bg-sky-50 disabled:opacity-50">
              {labels.today}
            </button>
            <button type="button" onClick={() => visit({ date: shiftIso(date, 1) })} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              {labels.next}
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </button>
          </div>
          <Button type="button" size="sm" className="h-9 lg:ms-auto" disabled={visible.length === 0 || marking || isPending} onClick={markVisibleAttended}>
            {labels.markAll}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(["ALL", "ATTENDED", "LATE", "ABSENT", "EXCUSED"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
                filter === key ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 ring-1 ring-slate-200",
              )}
            >
              {key === "ALL" ? labels.all : statusLabel[key]}
              <Ltr className={cn("rounded-full px-1.5 text-[10px]", filter === key ? "bg-white/20" : "bg-slate-100")}>{counts[key]}</Ltr>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{labels.noStudents}</p> : null}
      {rows.length > 0 && visible.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{labels.noMatches}</p> : null}

      <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr className="h-9">
              <th className="sticky start-0 z-10 border-e border-slate-200 bg-slate-50 px-3 text-start font-medium">{labels.student}</th>
              <th className="px-2 text-start font-medium">{labels.status}</th>
              <th className="px-3 text-start font-medium">{labels.hours}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.id} className={cn("h-14 border-t border-slate-100", pendingId === student.id && "opacity-70")}>
                <td className="sticky start-0 z-10 border-e border-slate-200 bg-white px-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800">{initials(student)}</span>
                    <span className="min-w-0">
                      <span className="block max-w-[12rem] truncate text-sm font-medium leading-4">{fullName(student)}</span>
                      {student.badge ? <Ltr className="text-[11px] leading-4 text-slate-400">{student.badge}</Ltr> : null}
                    </span>
                  </div>
                </td>
                <td className="px-2">
                  <div className="flex gap-1">
                    {STATUSES.map((status) => {
                      const on = student.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setStatus(student, status)}
                          className={cn("h-7 whitespace-nowrap rounded-lg px-2 text-xs font-medium", on ? statusClass[status] : statusIdle[status])}
                        >
                          {statusLabel[status]}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3">
                  <TimingButton student={student} labels={labels} onOpen={() => setEditing(student.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HoursDialog
        student={editingStudent}
        labels={labels}
        date={date}
        courseId={courseId}
        officialStart={officialStart}
        cutoff={cutoff}
        timeZone={timeZone}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
          flash(labels.saved);
          setEditing(null);
          startTransition(() => router.refresh());
        }}
        onError={flash}
      />

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
          <p className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white shadow-lg">{toast}</p>
        </div>
      ) : null}
    </div>
  );
}

function TimingButton({
  student,
  labels,
  onOpen,
  className,
}: {
  student: AttendanceStudent;
  labels: AttendanceLabels;
  onOpen: () => void;
  className?: string;
}) {
  const hasTime = Boolean(student.checkIn);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-xs font-medium",
        hasTime ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-300 bg-white text-slate-600",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      {hasTime ? (
        <Ltr>
          {student.checkIn}
          {student.checkOut ? ` → ${student.checkOut}` : ""}
          {student.totalMinutes != null ? ` (${durationLabel(student.totalMinutes)})` : ""}
        </Ltr>
      ) : (
        labels.addHours
      )}
      {student.minutesLate != null && student.minutesLate > 0 ? (
        <span className="rounded-md bg-orange-100 px-1 text-[10px] font-medium text-orange-800">
          {fill(labels.lateTag, { n: student.minutesLate })}
        </span>
      ) : null}
    </button>
  );
}

function LatePreview({
  checkIn,
  checkOut,
  cutoff,
  labels,
}: {
  checkIn: string;
  checkOut: string;
  cutoff: number;
  labels: AttendanceLabels;
}) {
  if (!checkIn) return null;
  const preview = previewTimes(checkIn, checkOut, cutoff);
  if (preview.invalid) return <p className="mt-3 text-sm text-rose-700">{labels.invalid}</p>;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", preview.status === "LATE" ? "bg-orange-100 text-orange-800" : "bg-lime-100 text-lime-800")}>
        {preview.status === "LATE" ? fill(labels.lateTag, { n: preview.minutesLate }) : labels.attended}
      </span>
      {preview.totalMinutes != null ? <Ltr>{durationLabel(preview.totalMinutes)}</Ltr> : null}
    </p>
  );
}

function HoursDialog({
  student,
  labels,
  date,
  courseId,
  officialStart,
  cutoff,
  timeZone,
  onClose,
  onSaved,
  onError,
}: {
  student: AttendanceStudent | null;
  labels: AttendanceLabels;
  date: string;
  courseId: string;
  officialStart: string;
  cutoff: number;
  timeZone: string;
  onClose: () => void;
  onSaved: (student: AttendanceStudent) => void;
  onError: (message: string) => void;
}) {
  const [checkIn, setCheckIn] = useState(student?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(student?.checkOut ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCheckIn(student?.checkIn ?? "");
    setCheckOut(student?.checkOut ?? "");
    setError(null);
  }, [student]);

  function applyNow() {
    const value = nowHm(timeZone);
    if (!checkIn) setCheckIn(value);
    else setCheckOut(value);
  }

  function applyPlusTwo() {
    const base = parseHm(checkIn) ?? parseHm(officialStart) ?? 16 * 60;
    setCheckOut(fromMinutes(base + 120));
    if (!checkIn) setCheckIn(officialStart);
  }

  async function save() {
    if (!student) return;
    const next = previewTimes(checkIn, checkOut, cutoff);
    if (next.invalid) {
      setError(labels.invalid);
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("userId", student.id);
    formData.set("date", date);
    formData.set("courseId", courseId);
    formData.set("checkIn", checkIn);
    formData.set("checkOut", checkOut);
    const result = await saveAttendanceTimesAction(null, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      onError(result.error);
      return;
    }
    onSaved({
      ...student,
      checkIn,
      checkOut: checkOut || null,
      status: next.status,
      minutesLate: next.minutesLate,
      totalMinutes: next.totalMinutes,
    });
  }

  async function clear() {
    if (!student) return;
    setPending(true);
    const formData = new FormData();
    formData.set("userId", student.id);
    formData.set("date", date);
    formData.set("courseId", courseId);
    const result = await clearAttendanceTimesAction(null, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      onError(result.error);
      return;
    }
    onSaved({ ...student, checkIn: null, checkOut: null, minutesLate: null, totalMinutes: null });
  }

  return (
    <Dialog.Root open={student != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full max-w-[100vw] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">{labels.hoursTitle}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">{student ? fullName(student) : ""}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {error ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              {labels.checkIn}
              <Input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              {labels.checkOut}
              <Input type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={applyNow}>{labels.now}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCheckIn(officialStart)}>
              {labels.officialStart} <Ltr>{officialStart}</Ltr>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={applyPlusTwo}>{labels.plusTwo}</Button>
          </div>
          <LatePreview checkIn={checkIn} checkOut={checkOut} cutoff={cutoff} labels={labels} />
          <div className="mt-4 flex gap-2">
            <Button type="button" className="flex-1" disabled={pending || !checkIn} onClick={save}>{labels.save}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={clear}>{labels.clearTimes}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
