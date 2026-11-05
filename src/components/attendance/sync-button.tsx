"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAttendanceSheetAction } from "@/server/actions/attendance";

export function SyncAttendanceButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await syncAttendanceSheetAction();
            setFailed(Boolean(result?.error));
            setNote(result?.error ?? result?.success ?? null);
            if (result?.success) router.refresh();
          });
        }}
        className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-bright disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
      {note ? <span className={`text-sm ${failed ? "text-red-600" : "text-slate-600"}`}>{note}</span> : null}
    </div>
  );
}
