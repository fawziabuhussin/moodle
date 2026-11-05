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
  nameAr: string;
  passwordHint: string;
  statuses: Record<"PENDING" | "APPROVED" | "PAID" | "CANCELLED", string>;
};

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

  async function removeStudent(student: DirectoryStudent) {
    if (!canManage || !window.confirm(labels.confirmDelete)) return;
    setBusyId(student.id);
    const data = new FormData();
    data.set("id", student.id);
    const result = await deleteDirectoryStudentAction(null, data);
    setBusyId(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    if (profile?.id === student.id) setProfile(null);
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
      <div className="sticky top-16 z-20 -mx-4 mb-3 flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2 backdrop-blur md:-mx-8 md:flex-row md:items-center md:px-8">
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

      <div className={cn("max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm", visible.length === 0 && "hidden")}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr className="h-9">
              <th className="sticky start-0 z-10 border-e border-slate-200 bg-slate-50 px-3 text-start font-medium">{labels.name}</th>
              <th className="px-3 text-start font-medium">{labels.phone}</th>
              <th className="px-3 text-start font-medium">{labels.nationalId}</th>
              <th className="px-3 text-start font-medium">{labels.bank}</th>
              <th className="px-3 text-start font-medium">{labels.track}</th>
              <th className="px-3 text-start font-medium">{labels.attendance}</th>
              <th className="px-3 text-start font-medium">{labels.thisMonth}</th>
              <th className="px-3 text-start font-medium">{labels.status}</th>
              <th className="px-3 text-end font-medium">{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => {
              const tone = rateTone(student.attendancePercent);
              return (
                <tr key={student.id} className={cn("h-14 border-t border-slate-100", !student.active && "bg-slate-50 text-slate-500")}>
                  <td className={cn("sticky start-0 z-10 border-e border-slate-200 px-3", student.active ? "bg-white" : "bg-slate-50")}>
                    <button type="button" onClick={() => setProfile(student)} className="flex min-w-0 items-center gap-2 text-start">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">{initials(student)}</span>
                      <span className="min-w-0">
                        <span className="block max-w-[12rem] truncate font-medium">{fullName(student)}</span>
                        {student.nameAr && student.nameAr !== fullName(student) ? <span className="block max-w-[12rem] truncate text-[11px] text-slate-400">{student.nameAr}</span> : null}
                        {student.email ? <span className="block max-w-[12rem] truncate text-[11px] text-slate-400"><Ltr>{student.email}</Ltr></span> : null}
                      </span>
                    </button>
                  </td>
                  <td className="px-3"><Ltr>{student.phone || "—"}</Ltr></td>
                  <td className="px-3"><Ltr>{student.nationalId || "—"}</Ltr></td>
                  <td className="max-w-[12rem] px-3 text-xs text-slate-600"><Ltr>{[student.bankName, student.bankBranch, student.bankAccount].filter(Boolean).join(" · ") || (student.bankConfirmed ? labels.bankYes : labels.bankNo)}</Ltr></td>
                  <td className="max-w-[10rem] truncate px-3 text-slate-700">{student.track || "—"}</td>
                  <td className="px-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone.badge)}>
                      <Ltr>{student.attendanceLabel}</Ltr>
                    </span>
                  </td>
                  <td className="px-3">
                    {student.stipendStatus ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={student.stipendStatus}>{labels.statuses[student.stipendStatus]}</Badge>
                        <Ltr className="text-xs">{student.stipendLabel}</Ltr>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{labels.noStipend}</span>
                    )}
                  </td>
                  <td className="px-3">
                    <button
                      type="button"
                      disabled={!canManage || busyId === student.id}
                      onClick={() => toggleActive(student)}
                      className={cn("rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50", student.active ? "bg-lime-100 text-lime-800" : "bg-slate-200 text-slate-600")}
                    >
                      {student.active ? labels.active : labels.inactive}
                    </button>
                  </td>
                  <td className="px-3 text-end">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button type="button" onClick={() => setProfile(student)} className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-sky-50">
                        {labels.openProfile}
                      </button>
                      {canManage ? (
                        <>
                          <button type="button" onClick={() => { setEditError(null); setEditing(student); }} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                            {labels.edit}
                          </button>
                          <button type="button" disabled={busyId === student.id} onClick={() => removeStudent(student)} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
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

      <Dialog.Root open={editing != null} onOpenChange={(next) => { if (!next) setEditing(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full max-w-[100vw] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-4">
            {editing ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Dialog.Title className="text-base font-semibold">{labels.edit}</Dialog.Title>
                  <Dialog.Close className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <form onSubmit={saveStudent} className="grid gap-2">
                  <input type="hidden" name="id" value={editing.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="firstName" placeholder={labels.firstName} defaultValue={editing.firstName} required />
                    <Input name="lastName" placeholder={labels.lastName} defaultValue={editing.lastName} required />
                  </div>
                  <Input name="nameAr" placeholder={labels.nameAr} defaultValue={editing.nameAr ?? ""} />
                  <Input name="email" type="email" placeholder={labels.email} defaultValue={editing.email ?? ""} required />
                  <Input name="phone" placeholder={labels.phone} defaultValue={editing.phone ?? ""} />
                  <Input name="nationalId" placeholder={labels.nationalId} defaultValue={editing.nationalId ?? ""} dir="ltr" />
                  <Input name="academicTrack" placeholder={labels.track} defaultValue={editing.track ?? ""} />
                  <Input name="password" type="password" placeholder={labels.passwordHint} minLength={8} />
                  {editError ? <p className="text-sm text-rose-700">{editError}</p> : null}
                  <Button type="submit" disabled={savingEdit}>{savingEdit ? labels.saving : labels.edit}</Button>
                </form>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
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
