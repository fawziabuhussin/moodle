"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Locale } from "@/lib/constants";
import { formatMoney, formatPercent } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { bulkApproveStipendsAction, bulkPayStipendsAction, generateStipendsAction, setStipendStatusAction, updateStipendAction } from "@/server/actions/finance";

type Status = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type StipendRow = {
  id: string;
  name: string;
  periodLabel: string;
  attendancePercent: number | null;
  lateCount: number;
  base: number;
  deduction: number;
  bonus: number;
  finalAmount: number;
  status: Status;
  notes: string;
  volunteering: boolean;
};

export type StipendLabels = {
  search: string;
  month: string;
  generate: string;
  saving: string;
  approve: string;
  paid: string;
  bulkApprove: string;
  approvedMany: string;
  saved: string;
  attendance: string;
  lates: string;
  base: string;
  deduction: string;
  bonus: string;
  final: string;
  status: string;
  name: string;
  notes: string;
  edit: string;
  close: string;
  save: string;
  none: string;
  noMatches: string;
  formula: string;
  select: string;
  bulkPay: string;
  paidMany: string;
  volunteering: string;
  volunteerYes: string;
  volunteerNo: string;
  statuses: Record<Status, string>;
};

function rateTone(percent: number | null) {
  if (percent == null) return "bg-slate-100 text-slate-500";
  if (percent >= 85) return "bg-lime-100 text-lime-800";
  if (percent >= 70) return "bg-orange-100 text-orange-800";
  return "bg-rose-100 text-rose-800";
}

export function StipendSheet({
  mode,
  period,
  rows,
  locale,
  labels,
}: {
  mode: "manage" | "own";
  period: string;
  rows: StipendRow[];
  locale: Locale;
  labels: StipendLabels;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [edit, setEdit] = useState<StipendRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const signature = rows.map((row) => `${row.id}:${row.status}:${row.finalAmount}`).join("|");

  useEffect(() => {
    setOverrides({});
    setSelected(new Set());
  }, [signature]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(needle) || row.periodLabel.includes(needle));
  }, [rows, query]);

  useEffect(() => {
    if (!allRef.current) return;
    const picked = visible.filter((row) => selected.has(row.id)).length;
    allRef.current.indeterminate = picked > 0 && picked < visible.length;
  }, [selected, visible]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function statusOf(row: StipendRow): Status {
    return overrides[row.id] ?? row.status;
  }

  function toggleAll() {
    const every = visible.length > 0 && visible.every((row) => selected.has(row.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const row of visible) {
        if (every) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setStatus(row: StipendRow, status: Status) {
    const previous = statusOf(row);
    setOverrides((current) => ({ ...current, [row.id]: status }));
    setBusy(row.id);
    const data = new FormData();
    data.set("id", row.id);
    data.set("status", status);
    const result = await setStipendStatusAction(null, data);
    setBusy(null);
    if (result?.error) {
      setOverrides((current) => ({ ...current, [row.id]: previous }));
      notify(result.error);
      return;
    }
    notify(labels.saved);
    router.refresh();
  }

  async function approveSelected() {
    const ids = visible.filter((row) => selected.has(row.id)).map((row) => row.id);
    if (ids.length === 0) return;
    setBusy("bulk");
    const data = new FormData();
    for (const id of ids) data.append("id", id);
    const result = await bulkApproveStipendsAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    const count = Number(result?.success ?? 0);
    setOverrides((current) => {
      const next = { ...current };
      for (const row of visible) {
        if (selected.has(row.id) && statusOf(row) === "PENDING") next[row.id] = "APPROVED";
      }
      return next;
    });
    notify(fill(labels.approvedMany, { n: Number.isFinite(count) ? count : 0 }));
    router.refresh();
  }

  async function paySelected() {
    const ids = visible.filter((row) => selected.has(row.id)).map((row) => row.id);
    if (ids.length === 0) return;
    setBusy("pay");
    const data = new FormData();
    for (const id of ids) data.append("id", id);
    const result = await bulkPayStipendsAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    const count = Number(result?.success ?? 0);
    setOverrides((current) => {
      const next = { ...current };
      for (const row of visible) {
        if (selected.has(row.id) && statusOf(row) === "APPROVED") next[row.id] = "PAID";
      }
      return next;
    });
    notify(fill(labels.paidMany, { n: Number.isFinite(count) ? count : 0 }));
    router.refresh();
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    const result = await generateStipendsAction(null, new FormData(event.currentTarget));
    setGenerating(false);
    notify(result?.error || result?.success || labels.saved);
    if (!result?.error) router.refresh();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setBusy(edit.id);
    const result = await updateStipendAction(null, new FormData(event.currentTarget));
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    setEdit(null);
    notify(labels.saved);
    router.refresh();
  }

  const manage = mode === "manage";

  return (
    <div>
      {manage ? (
        <div className="sticky top-16 z-20 -mx-4 mb-3 flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="ps-9" />
            </div>
            <Input type="month" aria-label={labels.month} value={period} onChange={(event) => router.push(`/stipends?period=${event.target.value}`)} className="md:w-44" />
            <form onSubmit={generate} className="w-full md:w-auto">
              <input type="hidden" name="period" value={period} />
              <Button type="submit" variant="outline" disabled={generating} className="w-full md:w-auto">{generating ? labels.saving : labels.generate}</Button>
            </form>
            <Button type="button" onClick={approveSelected} disabled={busy === "bulk" || selected.size === 0} className="w-full md:w-auto">
              {labels.bulkApprove}
              {selected.size > 0 ? <Ltr>{selected.size}</Ltr> : null}
            </Button>
            <Button type="button" variant="outline" onClick={paySelected} disabled={busy === "pay" || selected.size === 0} className="w-full md:w-auto">
              {labels.bulkPay}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{labels.formula}</p>
        </div>
      ) : null}

      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{labels.none}</p> : null}
      {rows.length > 0 && visible.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noMatches}</p> : null}

      <ul className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm", manage ? "md:hidden" : "", visible.length === 0 && "hidden")}>
        {visible.map((row) => {
          const status = statusOf(row);
          return (
            <li key={row.id} className="border-b border-slate-100 px-3 py-2.5 last:border-b-0">
              <div className="flex items-center gap-2">
                {manage ? (
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={labels.select} className="size-4" />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{manage ? row.name : <Ltr>{row.periodLabel}</Ltr>}</span>
                <Badge tone={status}>{labels.statuses[status]}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className={cn("rounded-full px-2 py-0.5 font-medium", rateTone(row.attendancePercent))}>
                  <Ltr>{formatPercent(row.attendancePercent, locale)}</Ltr>
                </span>
                <span>{labels.lates} <Ltr>{row.lateCount}</Ltr></span>
                <span>{row.volunteering ? labels.volunteerYes : labels.volunteerNo}</span>
                <span className="font-medium text-slate-900"><Ltr>{formatMoney(row.finalAmount, locale)}</Ltr></span>
              </div>
              {manage ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" disabled={busy === row.id || status === "APPROVED" || status === "PAID"} onClick={() => setStatus(row, "APPROVED")}>{labels.approve}</Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy === row.id || status === "PAID"} onClick={() => setStatus(row, "PAID")}>{labels.paid}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(row)}>{labels.edit}</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {manage ? (
        <div className={cn("hidden overflow-x-auto rounded-2xl border border-slate-200/80 bg-card shadow-sm md:block", visible.length === 0 && "md:hidden")}>
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input ref={allRef} type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.length > 0 && visible.every((row) => selected.has(row.id))} className="size-4" />
                </th>
                <th className="px-2 py-2 text-start font-medium">{labels.name}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.attendance}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.lates}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.volunteering}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.base}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.deduction}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.bonus}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.final}</th>
                <th className="px-2 py-2 text-start font-medium">{labels.status}</th>
                <th className="px-3 py-2 text-end font-medium">{labels.approve}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const status = statusOf(row);
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={labels.select} className="size-4" />
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-1.5 font-medium">{row.name}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", rateTone(row.attendancePercent))}>
                        <Ltr>{formatPercent(row.attendancePercent, locale)}</Ltr>
                      </span>
                    </td>
                    <td className="px-2 py-1.5"><Ltr>{row.lateCount}</Ltr></td>
                    <td className="px-2 py-1.5 text-xs">{row.volunteering ? labels.volunteerYes : labels.volunteerNo}</td>
                    <td className="px-2 py-1.5"><Ltr>{formatMoney(row.base, locale)}</Ltr></td>
                    <td className="px-2 py-1.5"><Ltr>{formatMoney(row.deduction, locale)}</Ltr></td>
                    <td className="px-2 py-1.5"><Ltr>{formatMoney(row.bonus, locale)}</Ltr></td>
                    <td className="px-2 py-1.5 font-medium"><Ltr>{formatMoney(row.finalAmount, locale)}</Ltr></td>
                    <td className="px-2 py-1.5"><Badge tone={status}>{labels.statuses[status]}</Badge></td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <Button type="button" size="sm" variant="outline" disabled={busy === row.id || status === "APPROVED" || status === "PAID"} onClick={() => setStatus(row, "APPROVED")}>{labels.approve}</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy === row.id || status === "PAID"} onClick={() => setStatus(row, "PAID")}>{labels.paid}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(row)}>{labels.edit}</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog.Root open={edit != null} onOpenChange={(open) => { if (!open) setEdit(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full max-w-[100vw] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-4">
            {edit ? (
              <form onSubmit={saveEdit} className="grid gap-2">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <Dialog.Title className="text-base font-semibold">{edit.name}</Dialog.Title>
                  <Dialog.Close className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <input type="hidden" name="id" value={edit.id} />
                <label className="grid gap-1 text-xs text-slate-500">
                  {labels.base}
                  <Input name="baseAmount" type="number" min={0} step="0.01" defaultValue={edit.base} required />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  {labels.deduction}
                  <Input name="deductionAmount" type="number" min={0} step="0.01" defaultValue={edit.deduction} required />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  {labels.bonus}
                  <Input name="bonusAmount" type="number" min={0} step="0.01" defaultValue={edit.bonus} required />
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  {labels.status}
                  <Select name="status" defaultValue={statusOf(edit)}>
                    {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((status) => (
                      <option key={status} value={status}>{labels.statuses[status]}</option>
                    ))}
                  </Select>
                </label>
                <Textarea name="notes" defaultValue={edit.notes} placeholder={labels.notes} />
                <Button type="submit" disabled={busy === edit.id}>{busy === edit.id ? labels.saving : labels.save}</Button>
              </form>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div>
      ) : null}
    </div>
  );
}
