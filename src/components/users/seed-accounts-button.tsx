"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SeedAccountsButton({ label, pendingLabel, done }: { label: string; pendingLabel: string; done: string }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setNote(null);
    const response = await fetch("/api/admin/seed-accounts", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { count?: number; error?: string } | null;
    setPending(false);
    if (!response.ok || !body?.count) {
      setNote(body?.error ?? "Seed failed");
      return;
    }
    setNote(done.replace("{n}", String(body.count)));
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>{pending ? pendingLabel : label}</Button>
      {note ? <p className="text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}
