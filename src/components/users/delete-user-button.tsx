"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteUserAction } from "@/server/actions/people";

function ConfirmSubmit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function DeleteUserButton({
  id,
  label,
  pendingLabel,
  confirmLabel,
  cancelLabel,
  name,
  detail,
  compact,
}: {
  id: string;
  label: string;
  pendingLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  name?: string | null;
  detail?: string | null;
  compact?: boolean;
}) {
  const [state, action] = useActionState(deleteUserAction, null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={compact ? "grid size-9 place-items-center rounded-xl text-rose-700 hover:bg-rose-50" : "rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"}
      >
        {compact ? <Trash2 className="size-4" /> : label}
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-lg font-semibold text-slate-950">{label}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">{confirmLabel}</Dialog.Description>
            {name ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-950">
                {name}
                {detail ? <span className="mt-0.5 block font-normal text-rose-800">{detail}</span> : null}
              </p>
            ) : null}
            {state?.error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p> : null}
            <form action={action} className="mt-5 flex flex-wrap justify-end gap-2">
              <input type="hidden" name="id" value={id} />
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{cancelLabel}</Button>
              <ConfirmSubmit label={label} pendingLabel={pendingLabel} />
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
