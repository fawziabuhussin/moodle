"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  MapPin,
  Megaphone,
  MessagesSquare,
  Pin,
  Plus,
  Repeat,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { BrandArcs } from "@/components/brand";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { DashboardCopy } from "@/lib/dashboard-copy";
import { addDaysIso, occursOn, weekStartSunday, type ScheduleCategory, type ScheduleItem } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { createAnnouncementAction, deleteAnnouncementAction, toggleAnnouncementPinAction } from "@/server/actions/announcements";

const tones: Record<ScheduleCategory, string> = {
  PSYCHOMETRY: "border-sky-100 border-s-sky-500 bg-sky-50/80 text-sky-950",
  PYTHON_AI: "border-emerald-100 border-s-emerald-500 bg-emerald-50/80 text-emerald-950",
  HEBREW_YAEL: "border-indigo-100 border-s-indigo-500 bg-indigo-50/80 text-indigo-950",
  VOLUNTEERING: "border-amber-100 border-s-amber-500 bg-amber-50/80 text-amber-950",
  IDENTITY_LEADERSHIP: "border-teal-100 border-s-teal-500 bg-teal-50/80 text-teal-950",
  WORKSHOP: "border-violet-100 border-s-violet-500 bg-violet-50/80 text-violet-950",
  FOOD_BREAK: "border-slate-200 border-s-orange-400 bg-orange-50/50 text-slate-700",
  EXAM: "border-rose-100 border-s-rose-500 bg-rose-50/80 text-rose-950",
  GENERAL: "border-slate-200 border-s-slate-400 bg-white text-slate-800",
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  isPinned: boolean;
  when: string;
  author: string;
  role: string;
  course: string | null;
};

type SessionCard = { id: string; title: string; when: string; person: string; badge: string | null };

type Draft = {
  id?: string;
  titleHe: string;
  titleAr: string;
  category: ScheduleCategory;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomOrLocation: string;
  instructorName: string;
  recurrenceType: "WEEKLY" | "BIWEEKLY" | "ONCE";
  startDate: string;
  endDate: string;
  courseId: string;
  notify: boolean;
};

function blankDraft(dayOfWeek: number, startDate: string): Draft {
  return {
    titleHe: "",
    titleAr: "",
    category: "GENERAL",
    dayOfWeek,
    startTime: "09:00",
    endTime: "10:00",
    roomOrLocation: "",
    instructorName: "",
    recurrenceType: "WEEKLY",
    startDate,
    endDate: "",
    courseId: "",
    notify: false,
  };
}

export function CommandCenter({
  copy,
  locale,
  name,
  role,
  todayLabel,
  todayIso,
  executive,
  canSchedule,
  canAnnounce,
  canModerate,
  canAttend,
  kpis,
  items,
  courses,
  announcements,
  sessions,
  notice,
  showSessions = true,
}: {
  copy: DashboardCopy;
  locale: "he" | "ar" | "en";
  name: string;
  role: string;
  todayLabel: string;
  todayIso: string;
  executive: boolean;
  canSchedule: boolean;
  canAnnounce: boolean;
  canModerate: boolean;
  canAttend: boolean;
  kpis: { students: number; track800: number; trackBase: number; present: number; late: number; absent: number; rate: number; pending: number; courses: number; todayClasses: number };
  items: ScheduleItem[];
  courses: { id: string; code: string; title: string }[];
  announcements: Announcement[];
  sessions: SessionCard[];
  notice?: string | null;
  showSessions?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [weekStart, setWeekStart] = useState(() => weekStartSunday(todayIso));
  const [weekend, setWeekend] = useState(false);
  const [mobileDay, setMobileDay] = useState(() => Math.min(new Date(`${todayIso}T00:00:00Z`).getUTCDay(), 4));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [announce, setAnnounce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayCount = weekend ? 7 : 5;
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => addDaysIso(weekStart, index)), [dayCount, weekStart]);
  const repeatLabel = { WEEKLY: copy.weekly, BIWEEKLY: copy.biweekly, ONCE: copy.once };

  function openCreate(dayOfWeek: number, startDate: string) {
    setError(null);
    setDraft(blankDraft(dayOfWeek, startDate));
  }

  function openEdit(item: ScheduleItem) {
    setError(null);
    setDraft({
      id: item.id,
      titleHe: item.titleHe,
      titleAr: item.titleAr,
      category: item.category,
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      roomOrLocation: item.roomOrLocation ?? "",
      instructorName: item.instructorName ?? "",
      recurrenceType: item.recurrenceType,
      startDate: item.startDate,
      endDate: item.endDate ?? "",
      courseId: item.courseId ?? "",
      notify: false,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setError(null);
    const response = await fetch(draft.id ? `/api/schedule/${draft.id}` : "/api/schedule", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, courseId: draft.courseId || null, endDate: draft.endDate || null, notify: draft.notify }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Error");
      return;
    }
    setDraft(null);
    startTransition(() => router.refresh());
  }

  async function removeDraft() {
    if (!draft?.id) return;
    const response = await fetch(`/api/schedule/${draft.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setDraft(null);
    startTransition(() => router.refresh());
  }

  const total = Math.max(kpis.students, 1);
  const segments = [
    { key: "present", width: (kpis.present / total) * 100, className: "bg-lime-500", label: copy.present, count: kpis.present },
    { key: "late", width: (kpis.late / total) * 100, className: "bg-orange-500", label: copy.late, count: kpis.late },
    { key: "absent", width: (kpis.absent / total) * 100, className: "bg-rose-500", label: copy.absent, count: kpis.absent },
  ];

  return (
    <div className="grid gap-5">
      {notice ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-100">{notice}</p> : null}

      <section className="bg-ink relative isolate overflow-hidden rounded-[2rem] text-white shadow-[0_24px_60px_-24px_rgb(11_16_32/0.65)]">
        <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div aria-hidden className="absolute -top-24 -start-16 -z-10 size-72 rounded-full bg-sky-500/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 end-1/4 -z-10 size-72 rounded-full bg-orange-500/15 blur-3xl" />
        <BrandArcs animated className="absolute -end-6 -bottom-10 -z-10 w-64 opacity-50 sm:w-80 md:opacity-90 lg:end-[22rem] lg:w-72 xl:end-[26rem]" />
        <div className="flex flex-col gap-6 p-5 md:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-sky-100 ring-1 ring-white/10 backdrop-blur">
              <CalendarDays className="size-3.5 text-sky-300" />
              <Ltr>{todayLabel}</Ltr>
            </p>
            <h2 className="mt-4 text-2xl leading-tight font-extrabold tracking-tight md:text-4xl">
              {copy.wave}, <span className="text-brand-gradient">{name}</span>
            </h2>
            <p className="mt-2 text-sm text-slate-300 md:text-base">{copy.welcome}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {role ? <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium ring-1 ring-white/10">{role}</span> : null}
              <span className="rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-2.5 py-1 font-semibold shadow-[0_4px_14px_-4px_rgb(247_137_29/0.8)]">
                {copy.cohort} <Ltr>{copy.year}</Ltr>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-medium ring-1 ring-white/10">
                <Clock3 className="size-3.5 text-lime-300" />
                <Ltr>{kpis.todayClasses}</Ltr> {copy.todayClasses}
              </span>
            </div>
            {canAnnounce || canSchedule || canAttend ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {canAttend ? (
                  <Button asChild variant="brand" size="lg" className="rounded-2xl">
                    <Link href="/attendance"><CheckCheck className="size-4" />{copy.markToday}</Link>
                  </Button>
                ) : null}
                {canSchedule ? (
                  <Button type="button" variant="ghost" size="lg" className="rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15" onClick={() => openCreate(mobileDay, days[mobileDay] ?? todayIso)}>
                    <CalendarPlus className="size-4" />{copy.addSlot}
                  </Button>
                ) : null}
                {canAnnounce ? (
                  <Button type="button" variant="ghost" size="lg" className="rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15" onClick={() => setAnnounce(true)}>
                    <Megaphone className="size-4 rtl:-scale-x-100" />{copy.announce}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {executive ? (
            <Link href="/attendance" className="group relative flex shrink-0 items-center gap-5 self-start rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition-colors hover:bg-white/[0.09] md:p-5 lg:self-auto">
              <AttendanceRing rate={kpis.rate} segments={segments} total={total} />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{copy.attendance}</p>
                <p className="mt-1 text-3xl font-extrabold"><Ltr>{kpis.present + kpis.late}</Ltr><span className="text-base font-semibold text-slate-400"> / <Ltr>{kpis.students}</Ltr></span></p>
                <ul className="mt-2 grid gap-1 text-xs">
                  {segments.map((segment) => (
                    <li key={segment.key} className="flex items-center gap-2 text-slate-300">
                      <span className={cn("size-2 rounded-full", segment.className)} />
                      <span className="flex-1">{segment.label}</span>
                      <Ltr className="font-semibold text-white">{segment.count}</Ltr>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      {executive ? (
        <section className="entilaka-stagger grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Kpi href="/students" icon={GraduationCap} tone="sky" label={copy.students} value={kpis.students} hint={<><Ltr>{kpis.track800}</Ltr> {copy.trackSplit} · <Ltr>{kpis.trackBase}</Ltr> {copy.trackBase}</>} />
          <Kpi
            href="/attendance"
            icon={CheckCheck}
            tone="lime"
            label={copy.attendance}
            value={`${kpis.rate}%`}
            hint={
              <>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                  {segments.map((segment) => <span key={segment.key} className={cn("transition-[width] duration-700", segment.className)} style={{ width: `${segment.width}%` }} />)}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                  {segments.map((segment) => <span key={segment.key}>{segment.label} <Ltr className="font-semibold text-slate-700">{segment.count}</Ltr></span>)}
                </span>
              </>
            }
          />
          <Kpi href="/stipends" icon={Wallet} tone="orange" label={copy.stipends} value={kpis.pending} hint={copy.stipendHint} />
          <Kpi href="/courses" icon={BookOpen} tone="indigo" label={copy.courses} value={kpis.courses} hint={<><Ltr>{kpis.todayClasses}</Ltr> {copy.todayClasses}</>} />
        </section>
      ) : null}

      <section className="grid items-start gap-5 xl:grid-cols-12">
        <article className="rounded-3xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur xl:col-span-8 md:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionTitle icon={CalendarDays} tone="sky">{copy.calendar}</SectionTitle>
            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-100/80 p-1">
              <button type="button" onClick={() => setWeekStart((value) => addDaysIso(value, -7))} className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-xs"><ChevronLeft className="size-3.5 rtl:rotate-180" />{copy.prevWeek}</button>
              <button type="button" onClick={() => { setWeekStart(weekStartSunday(todayIso)); setMobileDay(Math.min(new Date(`${todayIso}T00:00:00Z`).getUTCDay(), weekend ? 6 : 4)); }} className="h-8 rounded-xl bg-white px-3 text-xs font-bold text-sky-700 shadow-xs">{copy.today}</button>
              <button type="button" onClick={() => setWeekStart((value) => addDaysIso(value, 7))} className="inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-xs">{copy.nextWeek}<ChevronRight className="size-3.5 rtl:rotate-180" /></button>
              <button type="button" aria-pressed={weekend} onClick={() => setWeekend((value) => !value)} className={cn("h-8 rounded-xl px-2.5 text-xs font-semibold transition-colors", weekend ? "bg-sky-600 text-white shadow-xs" : "text-slate-600 hover:bg-white")}>{copy.weekend}</button>
            </div>
          </div>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 md:hidden">
            {days.map((iso, index) => (
              <button
                key={iso}
                type="button"
                onClick={() => setMobileDay(index)}
                className={cn(
                  "flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold transition-all",
                  mobileDay === index ? "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_8px_18px_-8px_rgb(13_114_184/0.8)]" : "bg-slate-100 text-slate-600",
                  iso === todayIso && mobileDay !== index && "ring-2 ring-sky-300",
                )}
              >
                <span className="opacity-80">{copy.daysShort[index]}</span>
                <Ltr className="text-base font-bold">{iso.slice(8)}</Ltr>
              </button>
            ))}
          </div>
          <div className="md:hidden">{renderDay(days[mobileDay] ?? days[0], mobileDay)}</div>
          <div className="hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}>
            {days.map((iso, index) => renderDay(iso, index))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur xl:col-span-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <SectionTitle icon={Megaphone} tone="orange">{copy.board}</SectionTitle>
            {canAnnounce ? (
              <button type="button" onClick={() => setAnnounce(true)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-sky-50 px-2.5 text-xs font-semibold whitespace-nowrap text-sky-700 ring-1 ring-sky-100 transition-colors hover:bg-sky-100">
                <Plus className="size-3.5" />{copy.newAnnouncement}
              </button>
            ) : null}
          </div>
          <div className="grid max-h-[42rem] gap-2.5 overflow-y-auto">
            {announcements.length === 0 ? <EmptyState icon={Megaphone}>{copy.noAnnouncements}</EmptyState> : null}
            {announcements.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-3.5 ps-4 transition-shadow hover:shadow-sm",
                  item.isPinned ? "border-amber-200 bg-gradient-to-br from-amber-50/80 to-white" : "border-slate-200/80 bg-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 start-0 w-1",
                    item.priority === "URGENT" ? "bg-rose-500" : item.priority === "IMPORTANT" ? "bg-amber-400" : "bg-sky-400",
                  )}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={item.priority === "NORMAL" ? "SCHEDULED" : item.priority}>{item.priority === "URGENT" ? copy.urgent : item.priority === "IMPORTANT" ? copy.important : copy.normal}</Badge>
                  {item.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><Pin className="size-3" />{copy.pinned}</span> : null}
                  {item.course ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{item.course}</span> : null}
                </div>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-600">{item.body}</p>
                <p className="mt-2.5 text-[11px] text-slate-400">{item.author} · {item.role} · <Ltr>{item.when}</Ltr></p>
                {canModerate ? (
                  <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
                    <form action={async (data) => { await toggleAnnouncementPinAction(null, data); router.refresh(); }}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"><Pin className="size-3" />{item.isPinned ? copy.unpin : copy.pin}</button>
                    </form>
                    <form action={async (data) => { await deleteAnnouncementAction(null, data); router.refresh(); }}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline"><Trash2 className="size-3" />{copy.remove}</button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </section>

      {showSessions ? (
        <article className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle icon={MessagesSquare} tone="indigo">{copy.sessions}</SectionTitle>
            <Link href="/sessions" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
              {copy.openSessions}<ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
            </Link>
          </div>
          {sessions.length === 0 ? <EmptyState icon={MessagesSquare}>{copy.noSessions}</EmptyState> : null}
          <div className="grid gap-3 md:grid-cols-3">
            {sessions.map((item) => (
              <Link key={item.id} href="/sessions" className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Clock3 className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-slate-600">{item.person}</span>
                  <span className="mt-1 block text-xs text-slate-500"><Ltr>{item.when}</Ltr>{item.badge ? <> · <Ltr>{item.badge}</Ltr></> : null}</span>
                </span>
              </Link>
            ))}
          </div>
        </article>
      ) : null}

      <Dialog.Root open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
            {draft ? (
              <div className="grid gap-2">
                <div className="mb-1 flex items-center justify-between">
                  <Dialog.Title className="font-semibold">{draft.id ? copy.editSlot : copy.addSlot}</Dialog.Title>
                  <Dialog.Close className="rounded-lg p-1" aria-label={copy.close}><X className="size-4" /></Dialog.Close>
                </div>
                <Input value={draft.titleHe} onChange={(event) => setDraft({ ...draft, titleHe: event.target.value })} placeholder={copy.titleHe} />
                <Input value={draft.titleAr} onChange={(event) => setDraft({ ...draft, titleAr: event.target.value })} placeholder={copy.titleAr} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ScheduleCategory })} aria-label={copy.category}>
                    {(Object.keys(copy.categories) as ScheduleCategory[]).map((key) => <option key={key} value={key}>{copy.categories[key]}</option>)}
                  </Select>
                  <Select value={String(draft.dayOfWeek)} onChange={(event) => setDraft({ ...draft, dayOfWeek: Number(event.target.value) })} aria-label={copy.day}>
                    {copy.daysLong.map((label, index) => <option key={label} value={index}>{label}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} aria-label={copy.from} />
                  <Input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} aria-label={copy.until} />
                </div>
                <Select value={draft.recurrenceType} onChange={(event) => setDraft({ ...draft, recurrenceType: event.target.value as Draft["recurrenceType"] })} aria-label={copy.repetition}>
                  <option value="WEEKLY">{copy.repeatWeekly}</option>
                  <option value="BIWEEKLY">{copy.repeatBiweekly}</option>
                  <option value="ONCE">{copy.repeatOnce}</option>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} aria-label={copy.startDate} />
                  <Input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} aria-label={copy.endDate} />
                </div>
                <Input value={draft.roomOrLocation} onChange={(event) => setDraft({ ...draft, roomOrLocation: event.target.value })} placeholder={copy.room} />
                <Input value={draft.instructorName} onChange={(event) => setDraft({ ...draft, instructorName: event.target.value })} placeholder={copy.instructor} />
                <Select value={draft.courseId} onChange={(event) => setDraft({ ...draft, courseId: event.target.value })} aria-label={copy.course}>
                  <option value="">{copy.none}</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
                </Select>
                {draft.id ? null : <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.notify} onChange={(event) => setDraft({ ...draft, notify: event.target.checked })} />{copy.notify}</label>}
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <div className="mt-1 flex gap-2">
                  <Button type="button" disabled={pending} onClick={saveDraft} className="flex-1">{pending ? copy.saving : copy.save}</Button>
                  {draft.id ? <Button type="button" variant="outline" onClick={removeDraft}>{copy.remove}</Button> : null}
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={announce} onOpenChange={setAnnounce}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
            <form className="grid gap-2" onSubmit={async (event) => {
              event.preventDefault();
              const result = await createAnnouncementAction(null, new FormData(event.currentTarget));
              if (result?.error) { setError(result.error); return; }
              setAnnounce(false);
              startTransition(() => router.refresh());
            }}>
              <div className="mb-1 flex items-center justify-between">
                <Dialog.Title className="font-semibold">{copy.announce}</Dialog.Title>
                <Dialog.Close className="rounded-lg p-1" aria-label={copy.close}><X className="size-4" /></Dialog.Close>
              </div>
              <Input name="title" placeholder={copy.titleHe} required />
              <Textarea name="body" placeholder={copy.body} required />
              <Select name="priority" defaultValue="NORMAL" aria-label={copy.priority}>
                <option value="URGENT">{copy.urgent}</option>
                <option value="IMPORTANT">{copy.important}</option>
                <option value="NORMAL">{copy.normal}</option>
              </Select>
              <Select name="courseId" defaultValue="" aria-label={copy.audience}>
                <option value="">{copy.allStudents}</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
              </Select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPinned" />{copy.pinTop}</label>
              {error && announce ? <p className="text-sm text-rose-700">{error}</p> : null}
              <Button type="submit">{copy.save}</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );

  function renderDay(iso: string, index: number) {
    const blocks = items.filter((item) => occursOn(item, iso)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const today = iso === todayIso;
    return (
      <div
        key={iso}
        className={cn(
          "rounded-2xl border p-2 transition-colors",
          today ? "border-sky-200 bg-gradient-to-b from-sky-50 to-white shadow-[0_0_0_3px_rgb(26_143_216/0.08)]" : "border-slate-100 bg-slate-50/60",
        )}
      >
        <button
          type="button"
          onClick={() => canSchedule && openCreate(index >= 7 ? 0 : new Date(`${iso}T00:00:00Z`).getUTCDay(), iso)}
          className={cn("group mb-2 flex w-full items-center justify-between rounded-xl px-1 py-0.5 text-start", canSchedule ? "cursor-pointer" : "cursor-default")}
        >
          <span className={cn("text-xs font-bold", today ? "text-sky-700" : "text-slate-700")}>{copy.daysLong[new Date(`${iso}T00:00:00Z`).getUTCDay()]}</span>
          <span className="flex items-center gap-1">
            {canSchedule ? <Plus className="size-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
            <Ltr className={cn("text-[11px] font-semibold", today ? "rounded-full bg-sky-600 px-1.5 py-0.5 text-white" : "text-slate-400")}>{iso.slice(5)}</Ltr>
          </span>
        </button>
        <div className="grid gap-1.5">
          {blocks.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-1 py-4 text-center text-[11px] text-slate-400">{copy.emptyDay}</p> : null}
          {blocks.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => canSchedule && openEdit(item)}
              className={cn(
                "rounded-xl border border-s-[3px] px-2.5 py-2 text-start shadow-xs transition-all",
                tones[item.category],
                canSchedule ? "hover:-translate-y-px hover:shadow-sm" : "cursor-default",
              )}
            >
              <Ltr className="text-[11px] font-bold whitespace-nowrap tabular-nums opacity-80">{item.startTime}–{item.endTime}</Ltr>
              <span className="mt-0.5 block text-xs leading-4 font-semibold">{locale === "ar" ? item.titleAr : item.titleHe}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] opacity-75">
                {item.recurrenceType !== "ONCE" ? <span className="inline-flex items-center gap-0.5"><Repeat className="size-3" />{repeatLabel[item.recurrenceType]}</span> : null}
                {item.instructorName ? <span>{item.instructorName}</span> : null}
                {item.roomOrLocation ? <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{item.roomOrLocation}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}

const kpiTones = {
  sky: { tile: "from-sky-400 to-sky-600 shadow-[0_8px_18px_-6px_rgb(26_143_216/0.7)]", glow: "bg-sky-400/20", hover: "hover:border-sky-200" },
  lime: { tile: "from-lime-400 to-lime-600 shadow-[0_8px_18px_-6px_rgb(132_184_44/0.7)]", glow: "bg-lime-400/20", hover: "hover:border-lime-200" },
  orange: { tile: "from-orange-400 to-orange-600 shadow-[0_8px_18px_-6px_rgb(247_137_29/0.7)]", glow: "bg-orange-400/20", hover: "hover:border-orange-200" },
  indigo: { tile: "from-indigo-400 to-indigo-600 shadow-[0_8px_18px_-6px_rgb(99_102_241/0.6)]", glow: "bg-indigo-400/20", hover: "hover:border-indigo-200" },
} as const;

type Tone = keyof typeof kpiTones;

function Kpi({ href, icon: Icon, tone, label, value, hint }: { href: string; icon: LucideIcon; tone: Tone; label: string; value: string | number; hint: ReactNode }) {
  const style = kpiTones[tone];
  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-5",
        style.hover,
      )}
    >
      <span aria-hidden className={cn("absolute -end-10 -top-10 -z-10 size-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125", style.glow)} />
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-white", style.tile)}>
          <Icon className="size-5" />
        </span>
        <ArrowUpRight className="size-4 text-slate-300 transition-all group-hover:text-slate-500 rtl:-scale-x-100" />
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900"><Ltr>{value}</Ltr></p>
      <div className="mt-2 text-[11px] text-slate-500">{hint}</div>
    </Link>
  );
}

function SectionTitle({ icon: Icon, tone, children }: { icon: LucideIcon; tone: Tone; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
      <span className={cn("grid size-8 place-items-center rounded-xl bg-gradient-to-br text-white", kpiTones[tone].tile)}>
        <Icon className="size-4" />
      </span>
      {children}
    </h2>
  );
}

function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="bg-dots-dark grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><Icon className="size-5" /></span>
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

/** Donut of today's attendance: present, late, and absent as arcs of one ring. */
function AttendanceRing({ rate, segments, total }: { rate: number; segments: { key: string; count: number }[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const colors: Record<string, string> = { present: "#9fd047", late: "#f7891d", absent: "#f43f5e" };
  const arcs = segments.map((segment, index) => ({
    ...segment,
    length: (segment.count / total) * circumference,
    offset: segments.slice(0, index).reduce((sum, previous) => sum + (previous.count / total) * circumference, 0),
  }));
  return (
    <div className="relative size-28 shrink-0 md:size-32">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="9" />
        {arcs.map(({ key, length, offset }) => (
          <circle
            key={key}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={colors[key]}
            strokeWidth="9"
            strokeLinecap={length > 4 ? "round" : "butt"}
            strokeDasharray={`${Math.max(length - (length > 4 ? 3 : 0), 0)} ${circumference}`}
            strokeDashoffset={-offset}
            className="transition-[stroke-dasharray] duration-1000"
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <Ltr className="text-2xl font-extrabold md:text-3xl">{rate}%</Ltr>
      </div>
    </div>
  );
}
