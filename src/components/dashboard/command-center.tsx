"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Pin, Repeat, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { DashboardCopy } from "@/lib/dashboard-copy";
import { addDaysIso, occursOn, weekStartSunday, type ScheduleCategory, type ScheduleItem } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { createAnnouncementAction, deleteAnnouncementAction, toggleAnnouncementPinAction } from "@/server/actions/announcements";

const tones: Record<ScheduleCategory, string> = {
  PSYCHOMETRY: "border-sky-200 bg-sky-50 text-sky-900",
  PYTHON_AI: "border-emerald-200 bg-emerald-50 text-emerald-900",
  HEBREW_YAEL: "border-indigo-200 bg-indigo-50 text-indigo-900",
  VOLUNTEERING: "border-amber-200 bg-amber-50 text-amber-900",
  IDENTITY_LEADERSHIP: "border-teal-200 bg-teal-50 text-teal-900",
  WORKSHOP: "border-violet-200 bg-violet-50 text-violet-900",
  FOOD_BREAK: "border-slate-200 bg-slate-100 text-slate-600",
  EXAM: "border-rose-200 bg-rose-50 text-rose-900",
  GENERAL: "border-slate-200 bg-white text-slate-700",
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
    <div className="grid gap-4">
      {notice ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{notice}</p> : null}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-navy text-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="min-w-0">
            <p className="text-lg font-semibold md:text-xl">
              {copy.wave}, {name} <span aria-hidden>👋</span>
            </p>
            <p className="mt-1 text-sm text-sky-100">{copy.welcome}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2 py-0.5">{role}</span>
              <Ltr className="text-sky-100">{todayLabel}</Ltr>
              <span className="rounded-full bg-orange-500/90 px-2 py-0.5 font-medium">
                {copy.cohort} <Ltr>{copy.year}</Ltr>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAnnounce ? (
              <Button type="button" variant="secondary" className="bg-white text-slate-900" onClick={() => setAnnounce(true)}>📢 {copy.announce}</Button>
            ) : null}
            {canSchedule ? (
              <Button type="button" variant="secondary" className="bg-white text-slate-900" onClick={() => openCreate(mobileDay, days[mobileDay] ?? todayIso)}>➕ {copy.addSlot}</Button>
            ) : null}
            {canAttend ? (
              <Button asChild className="bg-primary-bright hover:bg-primary"><Link href="/attendance">✅ {copy.markToday}</Link></Button>
            ) : null}
          </div>
        </div>
      </section>

      {executive ? (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi href="/students" icon="🎓" accent="border-t-sky-500" label={copy.students} value={kpis.students} hint={<><Ltr>{kpis.track800}</Ltr> {copy.trackSplit} · <Ltr>{kpis.trackBase}</Ltr> {copy.trackBase}</>} />
          <Kpi href="/attendance" icon="🕒" accent="border-t-emerald-500" label={copy.attendance} value={`${kpis.present}`} hint={<><Ltr>{kpis.rate}%</Ltr><span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-100">{segments.map((segment) => <span key={segment.key} className={segment.className} style={{ width: `${segment.width}%` }} />)}</span><span className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">{segments.map((segment) => <span key={segment.key}>{segment.label} <Ltr>{segment.count}</Ltr></span>)}</span></> } />
          <Kpi href="/stipends" icon="💳" accent="border-t-orange-500" label={copy.stipends} value={kpis.pending} hint={copy.stipendHint} />
          <Kpi href="/courses" icon="📚" accent="border-t-indigo-500" label={copy.courses} value={kpis.courses} hint={<><Ltr>{kpis.todayClasses}</Ltr> {copy.todayClasses}</>} />
        </section>
      ) : null}

      <section className="grid items-start gap-4 xl:grid-cols-12">
        <article className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-8 md:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">{copy.calendar}</h2>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => setWeekStart((value) => addDaysIso(value, -7))} className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-2 text-xs font-medium"><ChevronLeft className="size-3.5 rtl:rotate-180" />{copy.prevWeek}</button>
              <button type="button" onClick={() => { setWeekStart(weekStartSunday(todayIso)); setMobileDay(Math.min(new Date(`${todayIso}T00:00:00Z`).getUTCDay(), weekend ? 6 : 4)); }} className="h-8 rounded-xl border border-slate-200 px-2 text-xs font-medium text-primary">{copy.today}</button>
              <button type="button" onClick={() => setWeekStart((value) => addDaysIso(value, 7))} className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-2 text-xs font-medium">{copy.nextWeek}<ChevronRight className="size-3.5 rtl:rotate-180" /></button>
              <button type="button" aria-pressed={weekend} onClick={() => setWeekend((value) => !value)} className={cn("h-8 rounded-xl border px-2 text-xs", weekend ? "border-primary bg-sky-50 text-primary" : "border-slate-200")}>{copy.weekend}</button>
            </div>
          </div>
          <div className="mb-3 flex gap-1 overflow-x-auto md:hidden">
            {days.map((iso, index) => (
              <button key={iso} type="button" onClick={() => setMobileDay(index)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-medium", mobileDay === index ? "bg-primary text-white" : "bg-slate-100 text-slate-600", iso === todayIso && mobileDay !== index && "ring-1 ring-sky-300")}>
                {copy.daysShort[index]} <Ltr>{iso.slice(8)}</Ltr>
              </button>
            ))}
          </div>
          <div className="md:hidden">{renderDay(days[mobileDay] ?? days[0], mobileDay)}</div>
          <div className="hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}>
            {days.map((iso, index) => renderDay(iso, index))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{copy.board}</h2>
            {canAnnounce ? <button type="button" onClick={() => setAnnounce(true)} className="text-xs font-medium text-primary">+ {copy.newAnnouncement}</button> : null}
          </div>
          <div className="grid max-h-[42rem] gap-2 overflow-y-auto">
            {announcements.length === 0 ? <p className="text-sm text-slate-500">{copy.noAnnouncements}</p> : null}
            {announcements.map((item) => (
              <article key={item.id} className={cn("rounded-2xl border p-3", item.isPinned ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={item.priority} className={item.priority === "NORMAL" ? "bg-sky-100 text-sky-800" : undefined}>{item.priority === "URGENT" ? copy.urgent : item.priority === "IMPORTANT" ? copy.important : copy.normal}</Badge>
                  {item.isPinned ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">📌 {copy.pinned}</span> : null}
                  {item.course ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{item.course}</span> : null}
                </div>
                <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-[11px] text-slate-400">{item.author} · {item.role} · <Ltr>{item.when}</Ltr></p>
                {canModerate ? (
                  <div className="mt-2 flex gap-2">
                    <form action={async (data) => { await toggleAnnouncementPinAction(null, data); router.refresh(); }}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="text-[11px] font-medium text-primary">{item.isPinned ? copy.unpin : copy.pin}</button>
                    </form>
                    <form action={async (data) => { await deleteAnnouncementAction(null, data); router.refresh(); }}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="text-[11px] font-medium text-rose-700">{copy.remove}</button>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </section>

      <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{copy.sessions}</h2>
          <Link href="/sessions" className="text-xs font-medium text-primary">{copy.openSessions}</Link>
        </div>
        {sessions.length === 0 ? <p className="text-sm text-slate-500">{copy.noSessions}</p> : null}
        <div className="grid gap-2 md:grid-cols-3">
          {sessions.map((item) => (
            <Link key={item.id} href="/sessions" className="rounded-2xl border border-slate-200 p-3 hover:bg-slate-50">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.person}</p>
              <p className="mt-1 text-xs text-slate-500"><Ltr>{item.when}</Ltr>{item.badge ? <> · <Ltr>{item.badge}</Ltr></> : null}</p>
            </Link>
          ))}
        </div>
      </article>

      <Dialog.Root open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
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
      <div key={iso} className={cn("rounded-2xl border p-2", today ? "border-sky-200 bg-sky-50/50" : "border-slate-100 bg-slate-50/40")}>
        <button type="button" onClick={() => canSchedule && openCreate(index >= 7 ? 0 : new Date(`${iso}T00:00:00Z`).getUTCDay(), iso)} className="mb-2 flex w-full items-center justify-between text-start">
          <span className={cn("text-xs font-semibold", today && "text-primary")}>{copy.daysLong[new Date(`${iso}T00:00:00Z`).getUTCDay()]}</span>
          <Ltr className={cn("text-[11px]", today ? "rounded-full bg-primary px-1.5 text-white" : "text-slate-400")}>{iso.slice(5)}</Ltr>
        </button>
        <div className="grid gap-1.5">
          {blocks.length === 0 ? <p className="px-1 py-3 text-center text-[11px] text-slate-400">{copy.emptyDay}</p> : null}
          {blocks.map((item) => (
            <button key={item.id} type="button" onClick={() => canSchedule && openEdit(item)} className={cn("rounded-xl border px-2 py-1.5 text-start", tones[item.category], !canSchedule && "cursor-default")}>
              <Ltr className="whitespace-nowrap text-[11px] font-semibold tabular-nums">{item.startTime}–{item.endTime}</Ltr>
              <span className="mt-0.5 block text-xs font-medium leading-4">{locale === "ar" ? item.titleAr : item.titleHe}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] opacity-80">
                {item.recurrenceType !== "ONCE" ? <span className="inline-flex items-center gap-0.5"><Repeat className="size-3" />{repeatLabel[item.recurrenceType]}</span> : null}
                {item.instructorName ? <span>{item.instructorName}</span> : null}
                {item.roomOrLocation ? <span>{item.roomOrLocation}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
}

function Kpi({ href, icon, accent, label, value, hint }: { href: string; icon: string; accent: string; label: string; value: string | number; hint: ReactNode }) {
  return (
    <Link href={href} className={cn("rounded-2xl border border-slate-200 border-t-4 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", accent)}>
      <span className="grid size-9 place-items-center rounded-xl bg-slate-50 text-lg">{icon}</span>
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold"><Ltr>{value}</Ltr></p>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </Link>
  );
}
