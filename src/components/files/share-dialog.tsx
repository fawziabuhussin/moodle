"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { DriveAccess, DriveVisibility } from "@prisma/client";
import { Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setDriveAccessAction } from "@/server/actions/files";

export type ShareTarget = {
  kind: "folder" | "file";
  slug: string;
  name: string;
  visibility: DriveVisibility;
  access: DriveAccess;
  allowedUserIds: string[];
  allowedCourseIds: string[];
};

type Person = { id: string; name: string; badge: string | null };
type CourseOption = { id: string; code: string; title: string };

export type ShareCopy = {
  share: string;
  managersOnly: string;
  allStudents: string;
  specificCourses: string;
  specificStudents: string;
  sharedWith: string;
  viewOnly: string;
  canEditShare: string;
  who: string;
  pickCourses: string;
  pickStudents: string;
  searchStudents: string;
  save: string;
  saving: string;
  saved: string;
};

export function shareBadge(item: Pick<ShareTarget, "visibility" | "allowedUserIds" | "allowedCourseIds">, copy: ShareCopy) {
  if (item.visibility === "ALL_STUDENTS") return copy.allStudents;
  if (item.visibility === "SPECIFIC_COURSES" || item.visibility === "SPECIFIC_STUDENTS") {
    const count = item.visibility === "SPECIFIC_COURSES" ? item.allowedCourseIds.length : item.allowedUserIds.length;
    return copy.sharedWith.replace("{n}", String(count));
  }
  return copy.managersOnly;
}

export function ShareButton({
  item,
  students,
  courses,
  copy,
}: {
  item: ShareTarget;
  students: Person[];
  courses: CourseOption[];
  copy: ShareCopy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<DriveVisibility>(item.visibility);
  const [access, setAccess] = useState<DriveAccess>(item.access);
  const [pickedUsers, setPickedUsers] = useState<string[]>(item.allowedUserIds);
  const [pickedCourses, setPickedCourses] = useState<string[]>(item.allowedCourseIds);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => !needle || `${student.name} ${student.badge ?? ""}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [query, students]);

  function toggle(list: string[], id: string, set: (value: string[]) => void) {
    set(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  }

  function save() {
    const data = new FormData();
    data.set("kind", item.kind);
    data.set("slug", item.slug);
    data.set("visibility", visibility);
    data.set("access", access);
    for (const id of pickedUsers) data.append("userId", id);
    for (const id of pickedCourses) data.append("courseId", id);
    startTransition(async () => {
      const result = await setDriveAccessAction(null, data);
      setNote(result?.error ? result.error : copy.saved);
      if (!result?.error) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setVisibility(item.visibility);
        setAccess(item.access);
        setPickedUsers(item.allowedUserIds);
        setPickedCourses(item.allowedCourseIds);
        setQuery("");
        setNote(null);
      }
    }}>
      <Dialog.Trigger className="inline-flex max-w-[11rem] shrink-0 flex-col items-stretch gap-1 rounded-xl bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3 shrink-0" />
          <span className="truncate">{copy.share}</span>
        </span>
        <span className="truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">{shareBadge(item, copy)}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-semibold">{copy.share}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">{item.name}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1" aria-label={copy.share}><X className="size-4" /></Dialog.Close>
          </div>
          <label className="grid gap-1 text-sm">
            {copy.who}
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as DriveVisibility)} className="h-10 rounded-xl border border-slate-200 px-3">
              <option value="MANAGERS_ONLY">{copy.managersOnly}</option>
              <option value="ALL_STUDENTS">{copy.allStudents}</option>
              <option value="SPECIFIC_COURSES">{copy.specificCourses}</option>
              <option value="SPECIFIC_STUDENTS">{copy.specificStudents}</option>
            </select>
          </label>
          <div className="mt-3 flex gap-2 text-sm">
            <button type="button" onClick={() => setAccess("VIEW")} className={cn("h-9 flex-1 rounded-xl border", access === "VIEW" ? "border-primary bg-sky-50 text-primary" : "border-slate-200")}>{copy.viewOnly}</button>
            <button type="button" onClick={() => setAccess("EDIT")} className={cn("h-9 flex-1 rounded-xl border", access === "EDIT" ? "border-primary bg-sky-50 text-primary" : "border-slate-200")}>{copy.canEditShare}</button>
          </div>
          {visibility === "SPECIFIC_COURSES" ? (
            <div className="mt-3 grid gap-1">
              <p className="text-sm font-medium">{copy.pickCourses}</p>
              {courses.map((course) => (
                <label key={course.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pickedCourses.includes(course.id)} onChange={() => toggle(pickedCourses, course.id, setPickedCourses)} />
                  <Ltr>{course.code}</Ltr>
                  <span className="truncate">{course.title}</span>
                </label>
              ))}
            </div>
          ) : null}
          {visibility === "SPECIFIC_STUDENTS" ? (
            <div className="mt-3 grid gap-2">
              <p className="text-sm font-medium">{copy.pickStudents} · <Ltr>{pickedUsers.length}</Ltr></p>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchStudents} />
              <div className="grid max-h-48 gap-1 overflow-y-auto">
                {matches.map((student) => (
                  <button key={student.id} type="button" onClick={() => toggle(pickedUsers, student.id, setPickedUsers)} className={cn("flex items-center justify-between rounded-xl px-2 py-1.5 text-start text-sm", pickedUsers.includes(student.id) ? "bg-sky-50 text-primary" : "hover:bg-slate-50")}>
                    <span className="truncate">{student.name}</span>
                    {student.badge ? <Ltr className="text-xs text-slate-500">{student.badge}</Ltr> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {note ? <p className="mt-3 text-sm text-slate-600">{note}</p> : null}
          <button type="button" onClick={save} disabled={pending} className="mt-4 h-10 w-full rounded-xl bg-primary text-sm font-medium text-white disabled:opacity-60">{pending ? copy.saving : copy.save}</button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
