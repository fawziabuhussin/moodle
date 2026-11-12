"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ltr } from "@/components/ltr";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { fill } from "@/lib/i18n";
import { createCourseAction } from "@/server/actions/learning";

export type CourseRosterStudent = {
  id: string;
  name: string;
  badge: string | null;
  psychometry: string | null;
};

export function CreateCourseDialog({
  label,
  title,
  codeLabel,
  courseTitleLabel,
  descriptionLabel,
  startLabel,
  endLabel,
  rosterLabel,
  searchLabel,
  selectAllLabel,
  select800Label,
  selectBaseLabel,
  clearLabel,
  selectedLabel,
  saveLabel,
  savingLabel,
  closeLabel,
  students,
}: {
  label: string;
  title: string;
  codeLabel: string;
  courseTitleLabel: string;
  descriptionLabel: string;
  startLabel: string;
  endLabel: string;
  rosterLabel: string;
  searchLabel: string;
  selectAllLabel: string;
  select800Label: string;
  selectBaseLabel: string;
  clearLabel: string;
  selectedLabel: string;
  saveLabel: string;
  savingLabel: string;
  closeLabel: string;
  students: CourseRosterStudent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) => `${student.name} ${student.badge ?? ""}`.toLowerCase().includes(needle));
  }, [query, students]);

  function add(ids: string[]) {
    setPicked((current) => new Set([...current, ...ids]));
  }

  async function save(formData: FormData) {
    setPending(true);
    const result = await createCourseAction(null, formData);
    setPending(false);
    if (result?.error) {
      setNote(result.error);
      return;
    }
    setNote(null);
    setPicked(new Set());
    setQuery("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-sky-500 to-sky-600 px-5 text-sm font-semibold text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_8px_20px_-8px_rgb(13_114_184/0.7)] transition hover:from-sky-400 active:scale-[0.97]">
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white/90 p-4 shadow-2xl outline-none backdrop-blur-xl md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[40rem] md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-sky-800">{title}</p>
              <Dialog.Title className="text-xl font-semibold text-slate-950">{label.replace(/^\+\s*/, "")}</Dialog.Title>
            </div>
            <Dialog.Close className="rounded-full px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label={closeLabel}>
              ×
            </Dialog.Close>
          </div>
          <form action={save} className="grid gap-3">
            {note ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{note}</p> : null}
            {[...picked].map((id) => (
              <input key={id} type="hidden" name="studentIds" value={id} />
            ))}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={courseTitleLabel}>
                <Input name="title" required />
              </Field>
              <Field label={codeLabel}>
                <Input name="code" required dir="ltr" className="uppercase" placeholder="PY-800" />
              </Field>
            </div>
            <Field label={descriptionLabel}>
              <Textarea name="description" className="min-h-20 bg-white/80" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={startLabel}>
                <Input name="startDate" type="date" />
              </Field>
              <Field label={endLabel}>
                <Input name="endDate" type="date" />
              </Field>
            </div>
            <fieldset className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
              <legend className="px-1 text-sm font-semibold">{rosterLabel}</legend>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <button type="button" className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-white" onClick={() => add(students.map((student) => student.id))}>{selectAllLabel}</button>
                <button type="button" className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-900" onClick={() => add(students.filter((student) => student.psychometry === "800").map((student) => student.id))}>{select800Label}</button>
                <button type="button" className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-950" onClick={() => add(students.filter((student) => student.psychometry === "أساسية").map((student) => student.id))}>{selectBaseLabel}</button>
                <button type="button" className="rounded-full px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={() => setPicked(new Set())}>{clearLabel}</button>
                <span className="ms-auto self-center text-xs text-slate-500">{fill(selectedLabel, { n: picked.size })}</span>
              </div>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} />
              <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {visible.map((student) => (
                  <li key={student.id}>
                    <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-sky-50">
                      <input
                        type="checkbox"
                        checked={picked.has(student.id)}
                        onChange={() => {
                          setPicked((current) => {
                            const next = new Set(current);
                            if (next.has(student.id)) next.delete(student.id);
                            else next.add(student.id);
                            return next;
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{student.name}</span>
                      <Ltr className="text-xs text-slate-500">{student.badge || "—"}</Ltr>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <Button type="submit" disabled={pending}>{pending ? savingLabel : saveLabel}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
