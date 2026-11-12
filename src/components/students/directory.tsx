"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { ACTIVE_COHORT } from "@/lib/cohort";
import { cn, fullName, initials } from "@/lib/utils";
import { AccountEditor } from "@/components/students/account-editor";
import { createUserAction, deleteDirectoryStudentAction, setUserActiveAction, updateDirectoryStudentAction } from "@/server/actions/people";
import { ensureStudentStipendAction } from "@/server/actions/finance";

export type DirectoryStudent = {
  id: string;
  firstName: string;
  lastName: string;
  badge: string | null;
  email?: string | null;
  phone: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
  track: string | null;
  courses: { id: string; code: string; title: string }[];
  attendancePercent: number | null;
  attendanceLabel: string;
  stipendStatus: "PENDING" | "APPROVED" | "PAID" | "CANCELLED" | null;
  stipendLabel: string | null;
  lastSession: string | null;
  nameAr?: string | null;
  nationalId?: string | null;
  stipendApproval?: string | null;
  bankConfirmed?: boolean;
  cohort?: string | null;
  volunteering?: string | null;
  city?: string | null;
  psychometry?: string | null;
  active: boolean;
};

export type DirectoryLabels = {
  search: string;
  all: string;
  filterTrack: string;
  tracks: string;
  courses: string;
  addStudent: string;
  viewProfile: string;
  logSession: string;
  addStipend: string;
  lastSession: string;
  noSession: string;
  noStipend: string;
  thisMonth: string;
  attendance: string;
  name: string;
  actions: string;
  empty: string;
  noMatches: string;
  saved: string;
  close: string;
  create: string;
  saving: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  badge: string;
  track: string;
  defaultStipend: string;
  city: string;
  volunteering: string;
  cohort: string;
  nationalId: string;
  psychometry: string;
  bank: string;
  bankYes: string;
  bankNo: string;
  saveAccount: string;
  resetPassword: string;
  branch: string;
  accountNumber: string;
  openProfile: string;
  activeYear: string;
  archiveYear: string;
  archiveNote: string;
  status: string;
  active: string;
  inactive: string;
  edit: string;
  remove: string;
  confirmDelete: string;
  cancel: string;
  nameAr: string;
  passwordHint: string;
  statuses: Record<"PENDING" | "APPROVED" | "PAID" | "CANCELLED", string>;
};

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-start text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="truncate font-medium">{value || "—"}</dd>
    </div>
  );
}

function rateTone(percent: number | null) {
  if (percent == null) return { badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300" };
  if (percent >= 85) return { badge: "bg-lime-100 text-lime-800", bar: "bg-lime-600" };
  if (percent >= 70) return { badge: "bg-orange-100 text-orange-800", bar: "bg-orange-500" };
  return { badge: "bg-rose-100 text-rose-800", bar: "bg-rose-600" };
}

export function StudentsDirectory({
  students,
  tracks,
  courses,
  studentRoleId,
  archive = false,
  activeCount,
  archiveCount,
  canAdd,
  canManage,
  canLog,
  canStipend,
  labels,
}: {
  students: DirectoryStudent[];
  tracks: string[];
  courses: { id: string; label: string }[];
  studentRoleId: string | null;
  archive?: boolean;
  activeCount: number;
  archiveCount: number;
  canAdd: boolean;
  canManage: boolean;
  canLog: boolean;
  canStipend: boolean;
  labels: DirectoryLabels;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [stipendFor, setStipendFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<DirectoryStudent | null>(null);
  const [editing, setEditing] = useState<DirectoryStudent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DirectoryStudent | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      if (filter.startsWith("track:") && student.track !== filter.slice(6)) return false;
      if (filter.startsWith("course:") && !student.courses.some((course) => course.id === filter.slice(7))) return false;
      if (!needle) return true;
      const haystack = [fullName(student), student.nameAr, student.email, student.nationalId, student.badge, student.phone, student.bankName, student.bankAccount, student.track, student.cohort, ...student.courses.map((course) => `${course.code} ${course.title}`)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [students, query, filter]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  async function addStipend(studentId: string) {
    setStipendFor(studentId);
    const data = new FormData();
    data.set("studentId", studentId);
    const result = await ensureStudentStipendAction(null, data);
    setStipendFor(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(labels.saved);
    router.refresh();
  }

  async function toggleActive(student: DirectoryStudent) {
    if (!canManage) return;
    setBusyId(student.id);
    const data = new FormData();
    data.set("id", student.id);
    data.set("isActive", student.active ? "0" : "1");
    const result = await setUserActiveAction(null, data);
    setBusyId(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(labels.saved);
    router.refresh();
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEdit(true);
    setEditError(null);
    const result = await updateDirectoryStudentAction(null, new FormData(event.currentTarget));
    setSavingEdit(false);
    if (result?.error) {
      setEditError(result.error);
      return;
    }
    setEditing(null);
    notify(labels.saved);
    router.refresh();
  }

  async function removeStudent() {
    if (!canManage || !pendingDelete) return;
    const student = pendingDelete;
    setBusyId(student.id);
    const data = new FormData();
    data.set("id", student.id);
    const result = await deleteDirectoryStudentAction(null, data);
    setBusyId(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    setPendingDelete(null);
    if (profile?.id === student.id) setProfile(null);
    if (editing?.id === student.id) setEditing(null);
    notify(labels.saved);
    router.refresh();
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const result = await createUserAction(null, new FormData(event.currentTarget));
    setCreating(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setFormKey((key) => key + 1);
    notify(labels.saved);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Link
          href="/students"
          aria-current={archive ? undefined : "page"}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium", archive ? "bg-white text-slate-600 ring-1 ring-slate-200" : "bg-primary text-primary-foreground")}
        >
          {labels.activeYear}
          <Ltr className={cn("rounded-full px-1.5 text-[10px]", archive ? "bg-slate-100" : "bg-white/20")}>{activeCount}</Ltr>
        </Link>
        <Link
          href="/students?view=archive"
          aria-current={archive ? "page" : undefined}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium", archive ? "bg-primary text-primary-foreground" : "bg-white text-slate-600 ring-1 ring-slate-200")}
        >
          {labels.archiveYear}
          <Ltr className={cn("rounded-full px-1.5 text-[10px]", archive ? "bg-white/20" : "bg-slate-100")}>{archiveCount}</Ltr>
        </Link>
      </div>
      {archive ? <p className="mb-3 text-sm text-slate-500">{labels.archiveNote}</p> : null}
      <div className="z-20 -mx-4 mb-3 flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-2 md:sticky md:top-16 md:-mx-8 md:flex-row md:items-center md:bg-slate-50/95 md:px-8 md:backdrop-blur">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="ps-9" />
        </div>
        <div className="flex items-center gap-2 md:w-auto">
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label={labels.filterTrack} className="md:w-56">
            <option value="">{labels.all}</option>
            {tracks.length > 0 ? (
              <optgroup label={labels.tracks}>
                {tracks.map((track) => (
                  <option key={track} value={`track:${track}`}>{track}</option>
                ))}
              </optgroup>
            ) : null}
            {courses.length > 0 ? (
              <optgroup label={labels.courses}>
                {courses.map((course) => (
                  <option key={course.id} value={`course:${course.id}`}>{course.label}</option>
                ))}
              </optgroup>
            ) : null}
          </Select>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 tabular-nums"><Ltr>{visible.length}</Ltr></span>
        </div>
        {canAdd && studentRoleId ? (
          <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
            <Plus className="size-4" />
            {labels.addStudent}
          </Button>
        ) : null}
      </div>

      {students.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}
      {students.length > 0 && visible.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noMatches}</p> : null}

      <ul className={cn("grid gap-2 md:hidden", visible.length === 0 && "hidden")}>
        {visible.map((student) => {
          const tone = rateTone(student.attendancePercent);
          return (
            <li key={student.id} className={cn("rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", !student.active && "bg-slate-50")}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => setProfile(student)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">{initials(student)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">{fullName(student)}</span>
                    {student.nameAr && student.nameAr !== fullName(student) ? <span className="block truncate text-xs text-slate-500">{student.nameAr}</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!canManage || busyId === student.id}
                  onClick={() => toggleActive(student)}
                  className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-medium disabled:opacity-50", student.active ? "bg-lime-100 text-lime-800" : "bg-slate-200 text-slate-600")}
                >
                  {student.active ? labels.active : labels.inactive}
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-slate-400">{labels.phone}</dt>
                  <dd className="font-medium text-slate-800"><Ltr>{student.phone || "—"}</Ltr></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400">{labels.nationalId}</dt>
                  <dd className="font-medium text-slate-800"><Ltr>{student.nationalId || "—"}</Ltr></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400">{labels.track}</dt>
                  <dd className="truncate font-medium text-slate-800">{student.track || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400">{labels.attendance}</dt>
                  <dd><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone.badge)}><Ltr>{student.attendanceLabel}</Ltr></span></dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                {student.stipendStatus ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Badge tone={student.stipendStatus}>{labels.statuses[student.stipendStatus]}</Badge>
                    <Ltr className="truncate">{student.stipendLabel}</Ltr>
                  </span>
                ) : (
                  <span className="text-slate-400">{labels.noStipend}</span>
                )}
              </div>
              <div className={cn("mt-3 grid gap-1.5", canManage ? "grid-cols-3" : "grid-cols-1")}>
                <button type="button" onClick={() => setProfile(student)} className="min-h-9 rounded-xl bg-sky-50 px-1 py-2 text-[11px] font-medium leading-tight text-primary">
                  {labels.openProfile}
                </button>
                {canManage ? (
                  <>
                    <button type="button" onClick={() => { setEditError(null); setEditing(student); }} className="min-h-9 rounded-xl bg-slate-100 px-1 py-2 text-[11px] font-medium leading-tight text-slate-700">
                      {labels.edit}
                    </button>
                    <button type="button" disabled={busyId === student.id} onClick={() => setPendingDelete(student)} className="min-h-9 rounded-xl bg-rose-50 px-1 py-2 text-[11px] font-medium leading-tight text-rose-700 disabled:opacity-50">
                      {labels.remove}
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className={cn("hidden max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block", visible.length === 0 && "md:hidden")}>
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr className="h-9">
              <th className="sticky start-0 z-10 border-b border-e border-slate-200 bg-slate-50 px-3 text-start font-medium">{labels.name}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.phone}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.nationalId}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.bank}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.track}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.attendance}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.thisMonth}</th>
              <th className="border-b border-slate-200 px-3 text-start font-medium">{labels.status}</th>
              <th className="border-b border-slate-200 px-3 text-end font-medium">{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => {
              const tone = rateTone(student.attendancePercent);
              return (
                <tr key={student.id} className={cn("h-14", !student.active && "text-slate-500")}>
                  <td className={cn("sticky start-0 z-10 border-e border-t border-slate-200 px-3", student.active ? "bg-white" : "bg-slate-50")}>
                    <button type="button" onClick={() => setProfile(student)} className="flex min-w-0 items-center gap-2 text-start">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">{initials(student)}</span>
                      <span className="min-w-0">
                        <span className="block max-w-[12rem] truncate font-medium">{fullName(student)}</span>
                        {student.nameAr && student.nameAr !== fullName(student) ? <span className="block max-w-[12rem] truncate text-[11px] text-slate-400">{student.nameAr}</span> : null}
                        {student.email ? <span className="block max-w-[12rem] truncate text-[11px] text-slate-400"><Ltr>{student.email}</Ltr></span> : null}
                      </span>
                    </button>
                  </td>
                  <td className="border-t border-slate-100 px-3"><Ltr>{student.phone || "—"}</Ltr></td>
                  <td className="border-t border-slate-100 px-3"><Ltr>{student.nationalId || "—"}</Ltr></td>
                  <td className="max-w-[12rem] border-t border-slate-100 px-3 text-xs text-slate-600"><Ltr>{[student.bankName, student.bankBranch, student.bankAccount].filter(Boolean).join(" · ") || (student.bankConfirmed ? labels.bankYes : labels.bankNo)}</Ltr></td>
                  <td className="max-w-[10rem] truncate border-t border-slate-100 px-3 text-slate-700">{student.track || "—"}</td>
                  <td className="border-t border-slate-100 px-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone.badge)}>
                      <Ltr>{student.attendanceLabel}</Ltr>
                    </span>
                  </td>
                  <td className="border-t border-slate-100 px-3">
                    {student.stipendStatus ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={student.stipendStatus}>{labels.statuses[student.stipendStatus]}</Badge>
                        <Ltr className="text-xs">{student.stipendLabel}</Ltr>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{labels.noStipend}</span>
                    )}
                  </td>
                  <td className="border-t border-slate-100 px-3">
                    <button
                      type="button"
                      disabled={!canManage || busyId === student.id}
                      onClick={() => toggleActive(student)}
                      className={cn("rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50", student.active ? "bg-lime-100 text-lime-800" : "bg-slate-200 text-slate-600")}
                    >
                      {student.active ? labels.active : labels.inactive}
                    </button>
                  </td>
                  <td className="border-t border-slate-100 px-3 text-end">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button type="button" onClick={() => setProfile(student)} className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-sky-50">
                        {labels.openProfile}
                      </button>
                      {canManage ? (
                        <>
                          <button type="button" onClick={() => { setEditError(null); setEditing(student); }} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                            {labels.edit}
                          </button>
                          <button type="button" disabled={busyId === student.id} onClick={() => setPendingDelete(student)} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                            {labels.remove}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={profile != null} onOpenChange={(next) => { if (!next) setProfile(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-y-0 end-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-4 shadow-xl outline-none">
            {profile ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">{fullName(profile)}</Dialog.Title>
                    {profile.nameAr ? <p className="text-sm text-slate-500">{profile.nameAr}</p> : null}
                    <p className="text-sm"><Ltr>{profile.badge || "—"}</Ltr></p>
                  </div>
                  <Dialog.Close className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                  <Fact label={labels.track} value={profile.track} />
                  <Fact label={labels.cohort} value={profile.cohort} />
                  <Fact label={labels.attendance} value={<Ltr>{profile.attendanceLabel}</Ltr>} />
                  <Fact label={labels.thisMonth} value={profile.stipendStatus ? labels.statuses[profile.stipendStatus] : labels.noStipend} />
                  <Fact label={labels.psychometry} value={profile.psychometry} />
                  <Fact label={labels.city} value={profile.city} />
                  <Fact label={labels.volunteering} value={profile.volunteering} />
                  <Fact label={labels.nationalId} value={profile.nationalId ? <Ltr>{profile.nationalId}</Ltr> : null} />
                  <Fact label={labels.phone} value={profile.phone ? <Ltr>{profile.phone}</Ltr> : null} />
                  <Fact label={labels.email} value={profile.email ? <Ltr>{profile.email}</Ltr> : null} />
                  <Fact label={labels.bank} value={profile.bankConfirmed ? labels.bankYes : labels.bankNo} />
                  <Fact label={labels.bank} value={[profile.bankName, profile.bankBranch, profile.bankAccount].filter(Boolean).join(" · ") || null} />
                  <Fact label={labels.lastSession} value={profile.lastSession || labels.noSession} />
                </dl>
                {profile.courses.length > 0 ? (
                  <p className="mt-4 flex flex-wrap gap-1">
                    {profile.courses.map((course) => (
                      <span key={course.id} title={course.title} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800"><Ltr>{course.code}</Ltr></span>
                    ))}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild><Link href={`/students/${profile.id}`}>{labels.viewProfile}</Link></Button>
                  {canAdd ? (
                    <AccountEditor
                      account={{ id: profile.id, email: profile.email ?? "", phone: profile.phone, nationalId: profile.nationalId ?? null, bankName: profile.bankName ?? null, bankBranch: profile.bankBranch ?? null, bankAccount: profile.bankAccount ?? null, bankConfirmed: Boolean(profile.bankConfirmed) }}
                      editLabel={labels.viewProfile}
                      resetLabel={labels.resetPassword}
                      saveLabel={labels.saveAccount}
                      savingLabel={labels.saving}
                      closeLabel={labels.close}
                      emailLabel={labels.email}
                      phoneLabel={labels.phone}
                      bankLabel={labels.bank}
                      branchLabel={labels.branch}
                      accountLabel={labels.accountNumber}
                      confirmationLabel={labels.bankYes}
                    />
                  ) : null}
                  {canLog && profile.active ? <Button asChild variant="outline"><Link href={`/sessions?studentId=${profile.id}`}>{labels.logSession}</Link></Button> : null}
                  {canStipend && profile.active ? (
                    <Button type="button" variant="outline" disabled={stipendFor === profile.id} onClick={() => addStipend(profile.id)}>{labels.addStipend}</Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={pendingDelete != null} onOpenChange={(next) => { if (!next && busyId == null) setPendingDelete(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl outline-none">
            {pendingDelete ? (
              <>
                <Dialog.Title className="text-lg font-semibold text-slate-950">{labels.remove}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">{labels.confirmDelete}</Dialog.Description>
                <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-950">
                  {fullName(pendingDelete)}
                  {pendingDelete.nameAr ? <span className="mt-0.5 block font-normal text-rose-800">{pendingDelete.nameAr}</span> : null}
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={busyId === pendingDelete.id} onClick={() => setPendingDelete(null)}>{labels.cancel}</Button>
                  <Button type="button" variant="destructive" disabled={busyId === pendingDelete.id} onClick={removeStudent}>{labels.remove}</Button>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={editing != null} onOpenChange={(next) => { if (!next) setEditing(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(92dvh,760px)] w-[min(100vw-1.5rem,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
            {editing ? (
              <form key={editing.id} onSubmit={saveStudent} className="grid min-h-0 gap-4 overflow-y-auto p-5">
                <input type="hidden" name="id" value={editing.id} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-800">{initials(editing)}</span>
                    <div className="min-w-0">
                      <Dialog.Title className="text-lg font-semibold text-slate-950">{labels.edit}</Dialog.Title>
                      <p className="truncate text-sm text-slate-500">{fullName(editing)}</p>
                      {editing.nameAr ? <p className="truncate text-sm text-slate-400">{editing.nameAr}</p> : null}
                    </div>
                  </div>
                  <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LabeledField label={labels.firstName}>
                      <Input name="firstName" defaultValue={editing.firstName} required />
                    </LabeledField>
                    <LabeledField label={labels.lastName}>
                      <Input name="lastName" defaultValue={editing.lastName} required />
                    </LabeledField>
                  </div>
                  <LabeledField label={labels.nameAr}>
                    <Input name="nameAr" defaultValue={editing.nameAr ?? ""} />
                  </LabeledField>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledField label={labels.email}>
                    <Input name="email" type="email" defaultValue={editing.email ?? ""} required dir="ltr" />
                  </LabeledField>
                  <LabeledField label={labels.phone}>
                    <Input name="phone" defaultValue={editing.phone ?? ""} dir="ltr" />
                  </LabeledField>
                  <LabeledField label={labels.nationalId}>
                    <Input name="nationalId" defaultValue={editing.nationalId ?? ""} dir="ltr" />
                  </LabeledField>
                  <LabeledField label={labels.track}>
                    <Input name="academicTrack" defaultValue={editing.track ?? ""} />
                  </LabeledField>
                </div>
                <LabeledField label={labels.password}>
                  <Input name="password" type="password" minLength={8} autoComplete="new-password" />
                  <span className="text-[11px] font-normal text-slate-400">{labels.passwordHint}</span>
                </LabeledField>
                {editError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{editError}</p> : null}
                <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white pt-3">
                  <Button type="button" variant="outline" disabled={savingEdit} onClick={() => setEditing(null)}>{labels.cancel}</Button>
                  <Button type="submit" disabled={savingEdit}>{savingEdit ? labels.saving : labels.edit}</Button>
                </div>
              </form>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full max-w-[100vw] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Dialog.Title className="text-base font-semibold">{labels.addStudent}</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <form key={formKey} onSubmit={createStudent} className="grid gap-2">
              <input type="hidden" name="roleIds" value={studentRoleId ?? ""} />
              <input type="hidden" name="cohort" value={ACTIVE_COHORT} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="firstName" placeholder={labels.firstName} required />
                <Input name="lastName" placeholder={labels.lastName} required />
              </div>
              <Input name="email" type="email" placeholder={labels.email} required />
              <Input name="phone" placeholder={labels.phone} />
              <Input name="password" type="password" placeholder={labels.password} minLength={8} required />
              <Input name="hardwareBadgeId" placeholder={labels.badge} />
              <Input name="academicTrack" placeholder={labels.track} />
              <Input name="defaultStipendAmount" type="number" min={0} step="0.01" placeholder={labels.defaultStipend} />
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              <Button type="submit" disabled={creating}>{creating ? labels.saving : labels.create}</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div>
      ) : null}
    </div>
  );
}
