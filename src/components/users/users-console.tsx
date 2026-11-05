"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArchiveRestore, KeyRound, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ltr } from "@/components/ltr";
import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { DeleteUserButton } from "@/components/users/delete-user-button";
import { isCurrentYearStudent } from "@/lib/cohort";
import type { Locale } from "@/lib/constants";
import { cn, fullName } from "@/lib/utils";
import { resetStudentPasswordAction, saveManagedUserAction, setUserActiveAction } from "@/server/actions/people";

export type ManagedUser = {
  id: string;
  email: string;
  phone: string | null;
  loginPassword: string | null;
  isActive: boolean;
  firstName: string;
  lastName: string;
  nameAr: string | null;
  nameHe: string | null;
  nationalId: string | null;
  cohort: string | null;
  hardwareBadgeId: string | null;
  roles: { id: string; slug: string; name: string }[];
  courseIds: string[];
};

export type ManagedRole = { id: string; slug: string; name: string };
export type ManagedCourse = { id: string; code: string; title: string };

type FilterKey = "all" | "managers" | "teachers" | "students" | "archived";
type Primary = "" | "manager" | "teacher" | "student";

type Draft = {
  id: string | null;
  nameAr: string;
  nameHe: string;
  email: string;
  nationalId: string;
  phone: string;
  password: string;
  primary: Primary;
  extraRoleIds: string[];
  active: boolean;
  cohort: string;
  courseIds: string[];
};

const ROLE_CLASS: Record<string, string> = {
  manager: "bg-violet-100 text-violet-800",
  teacher: "bg-sky-100 text-sky-900",
  student: "bg-emerald-100 text-emerald-800",
  "finance-admin": "bg-amber-100 text-amber-950",
  mentor: "bg-orange-100 text-orange-950",
  coordinator: "bg-indigo-100 text-indigo-800",
  assistant: "bg-slate-100 text-slate-700",
};

const AVATAR_CLASS: Record<string, string> = {
  manager: "bg-violet-600",
  teacher: "bg-sky-600",
  student: "bg-emerald-600",
};

function primaryOf(slugs: string[]): Primary {
  if (slugs.includes("student")) return "student";
  if (slugs.includes("manager")) return "manager";
  if (slugs.includes("teacher")) return "teacher";
  return "";
}

function shownName(user: ManagedUser, locale: Locale) {
  const arabic = user.nameAr?.trim() || "";
  const hebrew = user.nameHe?.trim() || fullName(user);
  if (locale === "ar") return arabic || hebrew;
  return hebrew || arabic;
}

function otherName(user: ManagedUser, locale: Locale) {
  const primary = shownName(user, locale);
  const other = locale === "ar" ? user.nameHe?.trim() || fullName(user) : user.nameAr?.trim() || "";
  return other && other !== primary ? other : null;
}

function letters(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}` || "•";
}

function emptyDraft(): Draft {
  return {
    id: null,
    nameAr: "",
    nameHe: "",
    email: "",
    nationalId: "",
    phone: "",
    password: "",
    primary: "",
    extraRoleIds: [],
    active: true,
    cohort: "2026-2027",
    courseIds: [],
  };
}

function draftFrom(user: ManagedUser): Draft {
  const primary = primaryOf(user.roles.map((role) => role.slug));
  return {
    id: user.id,
    nameAr: user.nameAr ?? "",
    nameHe: user.nameHe?.trim() || fullName(user),
    email: user.email,
    nationalId: user.nationalId ?? "",
    phone: user.phone ?? "",
    password: user.loginPassword ?? "",
    primary,
    extraRoleIds: user.roles.filter((role) => !["manager", "teacher", "student"].includes(role.slug)).map((role) => role.id),
    active: user.isActive,
    cohort: user.cohort ?? (primary === "student" ? "2026-2027" : ""),
    courseIds: user.courseIds,
  };
}

export function UsersConsole({
  users,
  roles,
  courses,
  locale,
  currentUserId,
  labels,
}: {
  users: ManagedUser[];
  roles: ManagedRole[];
  courses: ManagedCourse[];
  locale: Locale;
  currentUserId: string;
  labels: {
    addButton: string;
    editUser: string;
    createTitle: string;
    kpiActive: string;
    kpiManagers: string;
    kpiTeachers: string;
    kpiStudents: string;
    kpiCohort: string;
    filterAll: string;
    filterManagers: string;
    filterTeachers: string;
    filterStudents: string;
    filterArchived: string;
    search: string;
    nameAr: string;
    nameHe: string;
    email: string;
    nationalId: string;
    phone: string;
    password: string;
    passwordHint: string;
    passwordStudentHint: string;
    primaryRole: string;
    roleManager: string;
    roleTeacher: string;
    roleStudent: string;
    extraRoles: string;
    linkCourses: string;
    cohort: string;
    accountState: string;
    active: string;
    archived: string;
    archive: string;
    restore: string;
    archiveConfirm: string;
    restoreConfirm: string;
    status: string;
    actions: string;
    user: string;
    contact: string;
    close: string;
    save: string;
    create: string;
    saving: string;
    deleteAccount: string;
    deleteConfirm: string;
    cancel: string;
    noResults: string;
    fullProfile: string;
    passwordReset: string;
  };
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [courseQuery, setCourseQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const counts = useMemo(() => {
    const active = users.filter((user) => user.isActive);
    return {
      active: active.length,
      managers: active.filter((user) => user.roles.some((role) => role.slug === "manager")).length,
      teachers: active.filter((user) => user.roles.some((role) => role.slug === "teacher")).length,
      students: active.filter((user) => user.roles.some((role) => role.slug === "student") && isCurrentYearStudent({ hardwareBadgeId: user.hardwareBadgeId, studentProfile: { cohort: user.cohort } })).length,
      archived: users.filter((user) => !user.isActive).length,
    };
  }, [users]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users
      .filter((user) => {
        if (filter === "archived") return !user.isActive;
        if (filter === "managers") return user.isActive && user.roles.some((role) => role.slug === "manager");
        if (filter === "teachers") return user.isActive && user.roles.some((role) => role.slug === "teacher");
        if (filter === "students") return user.isActive && user.roles.some((role) => role.slug === "student");
        return true;
      })
      .filter((user) => {
        if (!needle) return true;
        const haystack = [shownName(user, locale), otherName(user, locale), user.email, user.nationalId, user.phone, user.nameAr, user.nameHe]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => {
        const left = shownName(a, locale);
        const right = shownName(b, locale);
        if (left < right) return -1;
        if (left > right) return 1;
        return a.id < b.id ? -1 : 1;
      });
  }, [users, filter, query, locale]);

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: labels.filterAll, count: users.length },
    { key: "managers", label: labels.filterManagers, count: counts.managers },
    { key: "teachers", label: labels.filterTeachers, count: counts.teachers },
    { key: "students", label: labels.filterStudents, count: users.filter((user) => user.isActive && user.roles.some((role) => role.slug === "student")).length },
    { key: "archived", label: labels.filterArchived, count: counts.archived },
  ];

  const visibleCourses = courses.filter((course) => {
    const needle = courseQuery.trim().toLowerCase();
    if (!needle) return true;
    return `${course.code} ${course.title}`.toLowerCase().includes(needle);
  });

  const extras = roles.filter((role) => !["manager", "teacher", "student"].includes(role.slug));

  function roleLabel(role: { slug: string; name: string }) {
    if (role.slug === "manager") return labels.roleManager;
    if (role.slug === "teacher") return labels.roleTeacher;
    if (role.slug === "student") return labels.roleStudent;
    return role.name;
  }

  function openCreate() {
    setDraft(emptyDraft());
    setCourseQuery("");
    setNote(null);
    setOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setDraft(draftFrom(user));
    setCourseQuery("");
    setNote(null);
    setOpen(true);
  }

  async function save(formData: FormData) {
    setPending(true);
    const result = await saveManagedUserAction(null, formData);
    setPending(false);
    if (result?.error) {
      setNote(result.error);
      return;
    }
    setOpen(false);
    setFlash(result?.success ?? null);
    router.refresh();
  }

  async function toggleActive(user: ManagedUser) {
    const next = !user.isActive;
    if (!window.confirm(next ? labels.restoreConfirm : labels.archiveConfirm)) return;
    const data = new FormData();
    data.set("id", user.id);
    data.set("isActive", next ? "1" : "0");
    const result = await setUserActiveAction(null, data);
    setFlash(result?.error ?? result?.success ?? null);
    if (result?.success) router.refresh();
  }

  async function resetPassword(userId: string) {
    const data = new FormData();
    data.set("userId", userId);
    const result = await resetStudentPasswordAction(null, data);
    setFlash(result?.error ?? result?.success ?? labels.passwordReset);
    if (result?.success) router.refresh();
  }

  function toggleCourse(id: string) {
    setDraft((current) => ({
      ...current,
      courseIds: current.courseIds.includes(id) ? current.courseIds.filter((courseId) => courseId !== id) : [...current.courseIds, id],
    }));
  }

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/80">{labels.kpiActive}</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight"><Ltr>{counts.active}</Ltr></p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <Kpi label={labels.kpiManagers} value={counts.managers} />
            <Kpi label={labels.kpiTeachers} value={counts.teachers} />
            <Kpi label={labels.kpiStudents} value={counts.students} hint={labels.kpiCohort} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="ps-9" />
          </div>
          <button type="button" onClick={openCreate} className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            {labels.addButton}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", filter === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}
            >
              {item.label}
              <Ltr className={cn("rounded-full px-1.5 text-[10px]", filter === item.key ? "bg-white/20" : "bg-white")}>{item.count}</Ltr>
            </button>
          ))}
        </div>
      </div>

      {flash ? <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-950">{flash}</p> : null}
      {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{labels.noResults}</p> : null}

      <ul className="grid gap-2 md:hidden">
        {visible.map((user) => (
          <li key={user.id} className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
            <UserIdentity user={user} locale={locale} roleLabel={roleLabel} onOpen={() => openEdit(user)} />
            <Contact user={user} labels={labels} />
            <div className="mt-3 flex items-center justify-between gap-2">
              <Status active={user.isActive} activeLabel={labels.active} archivedLabel={labels.archived} />
              <Actions user={user} locale={locale} self={user.id === currentUserId} labels={labels} onEdit={() => openEdit(user)} onArchive={() => toggleActive(user)} onReset={() => resetPassword(user.id)} />
            </div>
          </li>
        ))}
      </ul>

      <div className={cn("hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm md:block", visible.length === 0 && "md:hidden")}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{labels.user}</th>
              <th className="px-4 py-3 text-start font-medium">{labels.contact}</th>
              <th className="px-4 py-3 text-start font-medium">{labels.status}</th>
              <th className="px-4 py-3 text-start font-medium">{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3"><UserIdentity user={user} locale={locale} roleLabel={roleLabel} onOpen={() => openEdit(user)} /></td>
                <td className="px-4 py-3"><Contact user={user} labels={labels} /></td>
                <td className="px-4 py-3"><Status active={user.isActive} activeLabel={labels.active} archivedLabel={labels.archived} /></td>
                <td className="px-4 py-3"><Actions user={user} locale={locale} self={user.id === currentUserId} labels={labels} onEdit={() => openEdit(user)} onArchive={() => toggleActive(user)} onReset={() => resetPassword(user.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white/90 p-4 shadow-2xl outline-none backdrop-blur-xl md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[42rem] md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-sky-800">{draft.id ? labels.editUser : labels.createTitle}</p>
                <Dialog.Title className="text-xl font-semibold text-slate-950">{draft.id ? labels.editUser : labels.addButton.replace(/^\+\s*/, "")}</Dialog.Title>
              </div>
              <Dialog.Close className="rounded-full px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label={labels.close}>×</Dialog.Close>
            </div>
            <form action={save} autoComplete="off" className="grid gap-3">
              {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
              <input type="hidden" name="primaryRole" value={draft.primary} />
              <input type="hidden" name="isActive" value={draft.active ? "1" : "0"} />
              {draft.primary === "student" ? <input type="hidden" name="cohort" value={draft.cohort} /> : null}
              {draft.primary === "student" ? draft.courseIds.map((id) => <input key={id} type="hidden" name="courseIds" value={id} />) : null}
              {draft.extraRoleIds.map((id) => <input key={id} type="hidden" name="extraRoleIds" value={id} />)}
              {note ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{note}</p> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={labels.nameAr}><Input name="nameAr" value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} /></Field>
                <Field label={labels.nameHe}><Input name="nameHe" value={draft.nameHe} onChange={(event) => setDraft({ ...draft, nameHe: event.target.value })} /></Field>
                <Field label={labels.email}><Input name="email" type="email" required dir="ltr" autoComplete="off" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
                <Field label={labels.nationalId}><Input name="nationalId" inputMode="numeric" maxLength={9} dir="ltr" value={draft.nationalId} onChange={(event) => setDraft({ ...draft, nationalId: event.target.value })} /></Field>
                <Field label={labels.phone}><Input name="phone" type="tel" dir="ltr" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
                <Field label={labels.password}>
                  <Input name="password" dir="ltr" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder={draft.id ? labels.passwordHint : labels.passwordStudentHint} />
                </Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{labels.primaryRole}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["manager", "teacher", "student"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={draft.primary === role}
                      onClick={() => setDraft({ ...draft, primary: role, cohort: role === "student" && !draft.cohort ? "2026-2027" : draft.cohort })}
                      className={cn("rounded-2xl border px-3 py-3 text-sm font-semibold", draft.primary === role ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}
                    >
                      {role === "manager" ? labels.roleManager : role === "teacher" ? labels.roleTeacher : labels.roleStudent}
                    </button>
                  ))}
                </div>
              </fieldset>
              {extras.length > 0 ? (
                <fieldset className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
                  <legend className="px-1 text-sm font-semibold">{labels.extraRoles}</legend>
                  <div className="flex flex-wrap gap-2">
                    {extras.map((role) => (
                      <label key={role.id} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.extraRoleIds.includes(role.id)}
                          onChange={() => setDraft({
                            ...draft,
                            extraRoleIds: draft.extraRoleIds.includes(role.id)
                              ? draft.extraRoleIds.filter((id) => id !== role.id)
                              : [...draft.extraRoleIds, role.id],
                          })}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {draft.primary === "student" ? (
                <fieldset className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
                  <legend className="px-1 text-sm font-semibold">{labels.linkCourses}</legend>
                  <label className="mt-2 grid gap-1 text-sm">
                    <span className="font-medium">{labels.cohort}</span>
                    <select value={draft.cohort} onChange={(event) => setDraft({ ...draft, cohort: event.target.value })} className="h-10 rounded-xl border border-input bg-white px-3 text-sm" dir="ltr">
                      <option value="2026-2027">2026-2027</option>
                      <option value="2025-2026">2025-2026</option>
                    </select>
                  </label>
                  <Input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder={labels.search} className="mt-2 bg-white" />
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {visibleCourses.map((course) => (
                      <li key={course.id}>
                        <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-sky-50">
                          <input type="checkbox" checked={draft.courseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                          <Ltr className="font-medium">{course.code}</Ltr>
                          <span className="truncate">{course.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{labels.accountState}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={draft.active} onClick={() => setDraft({ ...draft, active: true })} className={cn("rounded-2xl border px-3 py-2 text-sm font-medium", draft.active ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white")}>{labels.active}</button>
                  <button type="button" aria-pressed={!draft.active} onClick={() => setDraft({ ...draft, active: false })} className={cn("rounded-2xl border px-3 py-2 text-sm font-medium", !draft.active ? "border-slate-700 bg-slate-100 text-slate-900" : "border-slate-200 bg-white")}>{labels.archived}</button>
                </div>
              </fieldset>
              <div className="flex items-center justify-between gap-3">
                {draft.id ? <Link href={`/users/${draft.id}`} className="text-sm font-medium text-sky-800 hover:underline">{labels.fullProfile}</Link> : <span />}
                <button type="submit" disabled={pending} className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {pending ? labels.saving : draft.id ? labels.save : labels.create}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="min-h-[4.6rem] rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
      <p className="text-[11px] text-white/80">{label}</p>
      <p className="text-2xl font-semibold"><Ltr>{value}</Ltr></p>
      {hint ? <p className="text-[10px] text-white/70"><Ltr>{hint}</Ltr></p> : null}
    </div>
  );
}

function UserIdentity({ user, locale, roleLabel, onOpen }: { user: ManagedUser; locale: Locale; roleLabel: (role: ManagedUser["roles"][number]) => string; onOpen: () => void }) {
  const name = shownName(user, locale);
  const secondary = otherName(user, locale);
  const tone = primaryOf(user.roles.map((role) => role.slug)) || user.roles[0]?.slug || "assistant";
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white", AVATAR_CLASS[tone] ?? "bg-slate-500")}>{letters(name)}</span>
      <div className="min-w-0">
        <button type="button" onClick={onOpen} className="truncate text-start font-semibold text-slate-950 hover:underline">{name}</button>
        {secondary ? <p className="truncate text-xs text-slate-500">{secondary}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <span key={role.id} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ROLE_CLASS[role.slug] ?? "bg-slate-100 text-slate-700")}>{roleLabel(role)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Contact({ user, labels }: { user: ManagedUser; labels: { nationalId: string; email: string; phone: string; password: string } }) {
  return (
    <div className="grid gap-0.5 text-xs text-slate-600">
      <p><span className="text-slate-400">{labels.nationalId} </span><Ltr>{user.nationalId || "—"}</Ltr></p>
      <p className="truncate"><span className="text-slate-400">{labels.email} </span><Ltr>{user.email}</Ltr></p>
      <p><span className="text-slate-400">{labels.phone} </span><Ltr>{user.phone || "—"}</Ltr></p>
      <p><span className="text-slate-400">{labels.password} </span><Ltr>{user.loginPassword || "—"}</Ltr></p>
    </div>
  );
}

function Status({ active, activeLabel, archivedLabel }: { active: boolean; activeLabel: string; archivedLabel: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
      {active ? activeLabel : archivedLabel}
    </span>
  );
}

function Actions({
  user,
  locale,
  self,
  labels,
  onEdit,
  onArchive,
  onReset,
}: {
  user: ManagedUser;
  locale: Locale;
  self: boolean;
  labels: { editUser: string; archive: string; restore: string; password: string; deleteAccount: string; deleteConfirm: string; cancel: string; saving: string };
  onEdit: () => void;
  onArchive: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onEdit} title={labels.editUser} aria-label={labels.editUser} className="grid size-9 place-items-center rounded-xl text-slate-700 hover:bg-slate-100">
        <Pencil className="size-4" />
      </button>
      <button type="button" onClick={onReset} title={labels.password} aria-label={labels.password} className="grid size-9 place-items-center rounded-xl text-amber-800 hover:bg-amber-50">
        <KeyRound className="size-4" />
      </button>
      {self ? null : (
        <button type="button" onClick={onArchive} title={user.isActive ? labels.archive : labels.restore} aria-label={user.isActive ? labels.archive : labels.restore} className="grid size-9 place-items-center rounded-xl text-slate-700 hover:bg-slate-100">
          {user.isActive ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
        </button>
      )}
      {self ? null : (
        <DeleteUserButton
          compact
          id={user.id}
          name={shownName(user, locale)}
          detail={otherName(user, locale)}
          label={labels.deleteAccount}
          pendingLabel={labels.saving}
          confirmLabel={labels.deleteConfirm}
          cancelLabel={labels.cancel}
        />
      )}
    </div>
  );
}
