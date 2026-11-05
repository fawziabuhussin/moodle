"use client";

import { useState, useTransition } from "react";
import { syncRosterAction } from "@/server/actions/files";

export function SyncRosterButton({ label, pendingLabel, done }: { label: string; pendingLabel: string; done: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await syncRosterAction();
            setNote(result.error ?? done);
          });
        }}
        className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-bright disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
      {note ? <span className="text-sm text-slate-600">{note}</span> : null}
    </div>
  );
}
