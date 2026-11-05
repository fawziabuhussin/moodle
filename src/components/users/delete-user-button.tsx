"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteUserAction } from "@/server/actions/people";

function DeleteSubmit({ label, pendingLabel, compact }: { label: string; pendingLabel: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  if (compact) {
    return (
      <button type="submit" disabled={pending} title={label} aria-label={label} className="grid size-9 place-items-center rounded-xl text-rose-700 hover:bg-rose-50 disabled:opacity-50">
        <Trash2 className="size-4" />
      </button>
    );
  }
  return (
    <button type="submit" disabled={pending} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function DeleteUserButton({ id, label, pendingLabel, confirmLabel, compact }: { id: string; label: string; pendingLabel: string; confirmLabel: string; compact?: boolean }) {
  const [state, action] = useActionState(deleteUserAction, null);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmLabel)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit label={label} pendingLabel={pendingLabel} compact={compact} />
      {state?.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
    </form>
  );
}
