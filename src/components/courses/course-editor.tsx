"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/page-header";
import { Input, Textarea } from "@/components/ui/input";
import { updateCourseAction } from "@/server/actions/learning";

export function CourseEditor({
  course,
  canChangeCode,
  label,
  titleLabel,
  codeLabel,
  descriptionLabel,
  startLabel,
  endLabel,
  activeLabel,
  inactiveLabel,
  saveLabel,
  savingLabel,
  closeLabel,
  triggerClassName,
}: {
  course: { id: string; code: string; title: string; description: string; startDate: string; endDate: string; isActive: boolean };
  canChangeCode: boolean;
  label: string;
  titleLabel: string;
  codeLabel: string;
  descriptionLabel: string;
  startLabel: string;
  endLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  saveLabel: string;
  savingLabel: string;
  closeLabel: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(course.isActive);

  async function save(formData: FormData) {
    setPending(true);
    const result = await updateCourseAction(null, formData);
    setPending(false);
    if (result?.error) {
      setNote(result.error);
      return;
    }
    setNote(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={triggerClassName ?? "inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"}>
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl outline-none backdrop-blur-xl md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[36rem] md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">{label}</Dialog.Title>
            <Dialog.Close className="rounded-full px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label={closeLabel}>×</Dialog.Close>
          </div>
          <form action={save} className="grid gap-3">
            <input type="hidden" name="id" value={course.id} />
            {canChangeCode ? <input type="hidden" name="isActive" value={active ? "1" : "0"} /> : null}
            {note ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{note}</p> : null}
            <Field label={titleLabel}><Input name="title" defaultValue={course.title} required /></Field>
            {canChangeCode ? <Field label={codeLabel}><Input name="code" defaultValue={course.code} required dir="ltr" className="uppercase" /></Field> : null}
            <Field label={descriptionLabel}><Textarea name="description" defaultValue={course.description} className="min-h-20" /></Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={startLabel}><Input name="startDate" type="date" defaultValue={course.startDate} /></Field>
              <Field label={endLabel}><Input name="endDate" type="date" defaultValue={course.endDate} /></Field>
            </div>
            {canChangeCode ? (
              <button type="button" aria-pressed={active} onClick={() => setActive((value) => !value)} className={active ? "justify-self-start rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900" : "justify-self-start rounded-full bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700"}>
                {active ? activeLabel : inactiveLabel}
              </button>
            ) : null}
            <button type="submit" disabled={pending} className="justify-self-end rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? savingLabel : saveLabel}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
