"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ltr } from "@/components/ltr";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createSessionAction, setSessionStatusAction, updateSessionAction } from "@/server/actions/finance";

type Status = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type SessionRow = {
  id: string;
  title: string;
  status: Status;
  when: string;
  stamp: string;
  upcoming: boolean;
  duration: number;
  location: string;
  agenda: string;
  visibleNotes: string;
  staffNotes: string;
  actionItems: string;
  studentId: string;
  studentName: string;
  nationalId: string;
};

export type SessionStudent = { id: string; name: string; nationalId: string };

type TemplateKey = "academic" | "absence" | "committee" | "mentoring";

export type SessionLabels = {
  title: string;
  meetingTitle: string;
  create: string;
  createButton: string;
  save: string;
  saving: string;
  close: string;
  edit: string;
  upcoming: string;
  past: string;
  upcomingCount: string;
  none: string;
  meetingType: string;
  academic: string;
  absence: string;
  committee: string;
  mentoring: string;
  academicAgenda: string;
  absenceAgenda: string;
  committeeAgenda: string;
  mentoringAgenda: string;
  markCompleted: string;
  cancelMeeting: string;
  general: string;
  chooseStudent: string;
  student: string;
  when: string;
  duration: string;
  location: string;
  agenda: string;
  visibleNotes: string;
  staffNotes: string;
  actionItems: string;
  status: string;
  statuses: Record<Status, string>;
};

const STATUS_TONE: Record<Status, string> = {
  SCHEDULED: "bg-sky-100 text-sky-900",
  COMPLETED: "bg-lime-100 text-lime-900",
  CANCELLED: "bg-rose-100 text-rose-800",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

export function SessionsBoard({
  rows,
  students,
  preselect,
  showStaffNotes,
  labels,
}: {
  rows: SessionRow[];
  students: SessionStudent[];
  preselect: string;
  showStaffNotes: boolean;
  labels: SessionLabels;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const upcomingCount = rows.filter((row) => row.upcoming).length;
  const visible = useMemo(() => {
    const list = rows.filter((row) => (tab === "upcoming" ? row.upcoming : !row.upcoming));
    return list.sort((a, b) => (tab === "upcoming" ? a.when.localeCompare(b.when) : b.when.localeCompare(a.when)));
  }, [rows, tab]);
  const templates: { key: TemplateKey; title: string; agenda: string }[] = [
    { key: "academic", title: labels.academic, agenda: labels.academicAgenda },
    { key: "absence", title: labels.absence, agenda: labels.absenceAgenda },
    { key: "committee", title: labels.committee, agenda: labels.committeeAgenda },
    { key: "mentoring", title: labels.mentoring, agenda: labels.mentoringAgenda },
  ];

  useEffect(() => {
    if (preselect) {
      setEditing(null);
      setOpen(true);
    }
  }, [preselect]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: SessionRow) {
    setMenuId(null);
    setEditing(row);
    setOpen(true);
  }

  async function setStatus(row: SessionRow, status: Status) {
    setMenuId(null);
    setBusy(row.id);
    const data = new FormData();
    data.set("id", row.id);
    data.set("status", status);
    await setSessionStatusAction(null, data);
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{labels.title}</h1>
          <p className="text-sm text-slate-500">{fill(labels.upcomingCount, { n: upcomingCount })}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          {labels.createButton}
        </Button>
      </div>

      <div className="mb-3 inline-flex rounded-full bg-slate-100 p-1">
        {(["upcoming", "past"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? "page" : undefined}
            onClick={() => { setTab(key); setMenuId(null); }}
            className={cn("h-8 rounded-full px-3 text-xs font-medium", tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            {key === "upcoming" ? labels.upcoming : labels.past}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {visible.length === 0 ? <li className="px-4 py-6 text-sm text-slate-500">{labels.none}</li> : null}
        {visible.map((row) => {
          const type = templates.find((item) => item.title === row.title);
          return (
            <li key={row.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[row.status])}>{labels.statuses[row.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-5">{row.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {type && type.title !== row.title ? <span>{type.title} · </span> : null}
                  {row.studentName}
                  {row.nationalId ? <> · <Ltr className="tabular-nums">{row.nationalId}</Ltr></> : null}
                  {" · "}
                  <Ltr className="tabular-nums">{row.stamp}</Ltr>
                </p>
              </div>
              <div className="relative">
                <button type="button" aria-label={labels.edit} disabled={busy === row.id} onClick={() => setMenuId(menuId === row.id ? null : row.id)} className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
                  <MoreHorizontal className="size-4" />
                </button>
                {menuId === row.id ? (
                  <div className="absolute end-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    <button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50" onClick={() => openEdit(row)}>{labels.edit}</button>
                    <button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50 disabled:opacity-40" disabled={row.status === "COMPLETED"} onClick={() => setStatus(row, "COMPLETED")}>{labels.markCompleted}</button>
                    <button type="button" className="block w-full px-3 py-1.5 text-start text-rose-700 hover:bg-rose-50 disabled:opacity-40" disabled={row.status === "CANCELLED"} onClick={() => setStatus(row, "CANCELLED")}>{labels.cancelMeeting}</button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-y-0 end-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-xl outline-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <Dialog.Title className="text-base font-semibold">{editing ? labels.edit : labels.create}</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <SessionForm
              key={editing?.id ?? "new"}
              row={editing}
              students={students}
              preselect={preselect}
              templates={templates}
              showStaffNotes={showStaffNotes}
              labels={labels}
              onDone={() => { setOpen(false); router.refresh(); }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SessionForm({
  row,
  students,
  preselect,
  templates,
  showStaffNotes,
  labels,
  onDone,
}: {
  row: SessionRow | null;
  students: SessionStudent[];
  preselect: string;
  templates: { key: TemplateKey; title: string; agenda: string }[];
  showStaffNotes: boolean;
  labels: SessionLabels;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [agenda, setAgenda] = useState(row?.agenda ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const picked = templates.find((item) => item.title === title)?.key;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const result = row ? await updateSessionAction(null, data) : await createSessionAction(null, data);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
        <div>
          <p className="mb-2 text-sm font-medium">{labels.meetingType}</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={picked === item.key}
                onClick={() => { setTitle(item.title); setAgenda(item.agenda); }}
                className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", picked === item.key ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm font-medium sm:col-span-2">{labels.general}</p>
          <div className="sm:col-span-2">
            <Field label={labels.meetingTitle}>
              <Input name="title" value={title} required onChange={(event) => setTitle(event.target.value)} />
            </Field>
          </div>
          <Field label={labels.student}>
            <Select name="studentId" defaultValue={row?.studentId || preselect} required>
              <option value="">{labels.chooseStudent}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name}{student.nationalId ? ` · ${student.nationalId}` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label={labels.when}>
            <Input name="scheduledAt" type="datetime-local" required defaultValue={row?.when ?? ""} dir="ltr" />
          </Field>
          <Field label={labels.duration}>
            <Input name="durationMinutes" type="number" min={10} defaultValue={row?.duration ?? 45} dir="ltr" />
          </Field>
          <Field label={labels.location}>
            <Input name="locationOrLink" defaultValue={row?.location ?? ""} dir="ltr" />
          </Field>
          {row ? (
            <Field label={labels.status}>
              <Select name="status" defaultValue={row.status}>
                {(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((status) => (
                  <option key={status} value={status}>{labels.statuses[status]}</option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        <Field label={labels.agenda}>
          <Textarea name="agenda" value={agenda} onChange={(event) => setAgenda(event.target.value)} className="min-h-[100px]" />
        </Field>
        <Field label={labels.visibleNotes}>
          <Textarea name="studentVisibleNotes" defaultValue={row?.visibleNotes ?? ""} className="min-h-[100px]" />
        </Field>
        <Field label={labels.actionItems}>
          <Textarea name="actionItems" defaultValue={row?.actionItems ?? ""} className="min-h-[100px]" />
        </Field>
        {showStaffNotes ? (
          <Field label={labels.staffNotes}>
            <Textarea name="confidentialStaffNotes" defaultValue={row?.staffNotes ?? ""} className="min-h-[100px] border-rose-200 bg-rose-50" />
          </Field>
        ) : null}
      </div>
      <div className="border-t border-slate-200 px-4 py-3">
        <Button type="submit" className="w-full" disabled={pending}>{pending ? labels.saving : row ? labels.save : labels.create}</Button>
      </div>
    </form>
  );
}
