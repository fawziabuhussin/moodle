"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronLeft, ChevronRight, MessageCircle, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/constants";
import { localeTag } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { ACADEMIC_STIPEND_PERIODS, DEFAULT_STIPEND_BASE } from "@/lib/stipends";
import { cn } from "@/lib/utils";
import { applyMonthAmountAction, bulkApproveStipendsAction, bulkPayStipendsAction, deleteStipendAction, saveMonthStipendAction } from "@/server/actions/finance";

type Status = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type MonthRow = {
  id: string;
  studentId: string;
  name: string;
  nationalId: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  amount: number | null;
  deduction: number;
  bonus: number;
  finalAmount: number | null;
  notes: string;
  status: Status;
};

export type SummaryRow = {
  studentId: string;
  name: string;
  months: number;
  assigned: number;
  paid: number;
};

export type OwnRow = {
  id: string;
  periodLabel: string;
  amount: number;
  base: number;
  deduction: number;
  bonus: number;
  status: Status;
  notes: string;
  paidLabel: string;
};

export type StipendLabels = {
  search: string;
  month: string;
  previousMonth: string;
  nextMonth: string;
  saving: string;
  approve: string;
  paid: string;
  bulkApprove: string;
  approvedMany: string;
  saved: string;
  status: string;
  name: string;
  notes: string;
  none: string;
  noMatches: string;
  formula: string;
  select: string;
  bulkPay: string;
  paidMany: string;
  summary: string;
  monthView: string;
  amount: string;
  example: string;
  apply: string;
  monthTotal: string;
  totalGiven: string;
  totalPaid: string;
  waiting: string;
  months: string;
  base: string;
  deduction: string;
  bonus: string;
  paidOn: string;
  statuses: Record<Status, string>;
  save?: string;
  close?: string;
  post: string;
  edit: string;
  notPosted: string;
  net: string;
  remove: string;
  confirmDelete: string;
  invalid: string;
};

type Draft = { amount: string; deduction: string; bonus: string; notes: string };

const STATUS_TONE: Record<Status, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  APPROVED: "bg-sky-100 text-sky-900",
  PAID: "bg-lime-100 text-lime-900",
  CANCELLED: "bg-rose-100 text-rose-800",
};

function monthTitle(period: string, locale: Locale) {
  const [year, month] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat(localeTag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return { name, numeric: `${String(month).padStart(2, "0")}/${year}` };
}

function letters(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`;
}

export function StipendSheet({
  mode,
  view,
  period,
  rows,
  summary,
  ownRows,
  locale,
  labels,
}: {
  mode: "manage" | "own";
  view: "month" | "summary";
  period: string;
  rows: MonthRow[];
  summary: SummaryRow[];
  ownRows: OwnRow[];
  locale: Locale;
  labels: StipendLabels;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [example, setExample] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const signature = rows.map((row) => `${row.studentId}:${row.id}:${row.amount}:${row.deduction}:${row.bonus}:${row.finalAmount}:${row.notes}:${row.status}`).join("|");

  useEffect(() => {
    setStatusDrafts({});
    setSelected(new Set());
    setDrafts({});
    setNoteFor(null);
  }, [signature, view]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => rows.filter((row) => !needle || `${row.name} ${row.nationalId}`.toLowerCase().includes(needle)),
    [needle, rows],
  );
  const visibleSummary = useMemo(() => summary.filter((row) => !needle || row.name.toLowerCase().includes(needle)), [needle, summary]);

  useEffect(() => {
    if (!allRef.current) return;
    const picked = visible.filter((row) => selected.has(row.studentId)).length;
    allRef.current.indeterminate = picked > 0 && picked < visible.length;
  }, [selected, visible]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function valuesOf(row: MonthRow): Draft {
    return drafts[row.studentId] ?? {
      amount: row.amount == null ? String(DEFAULT_STIPEND_BASE) : String(row.amount),
      deduction: String(row.deduction),
      bonus: String(row.bonus),
      notes: row.notes,
    };
  }

  function statusOf(row: MonthRow): Status {
    return statusDrafts[row.studentId] ?? (row.id ? row.status : "PENDING");
  }

  function patch(row: MonthRow, change: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [row.studentId]: { ...valuesOf(row), ...change } }));
  }

  function rowDirty(row: MonthRow) {
    const draft = valuesOf(row);
    const base = row.amount == null ? DEFAULT_STIPEND_BASE : row.amount;
    const amount = Number(draft.amount);
    const deduction = Number(draft.deduction || "0");
    const bonus = Number(draft.bonus || "0");
    const amountDirty = draft.amount.trim() === "" || !Number.isFinite(amount) || amount !== base;
    return amountDirty || deduction !== row.deduction || bonus !== row.bonus || draft.notes !== row.notes || statusOf(row) !== (row.id ? row.status : "PENDING");
  }

  function netOf(row: MonthRow) {
    const draft = valuesOf(row);
    const amount = Number(draft.amount);
    const deduction = Number(draft.deduction || "0");
    const bonus = Number(draft.bonus || "0");
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(deduction) || deduction < 0 || !Number.isFinite(bonus) || bonus < 0) return null;
    return Math.max(0, amount - deduction + bonus);
  }

  function toggleAll() {
    const every = visible.length > 0 && visible.every((row) => selected.has(row.studentId));
    setSelected((current) => {
      const next = new Set(current);
      for (const row of visible) {
        if (every) next.delete(row.studentId);
        else next.add(row.studentId);
      }
      return next;
    });
  }

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function persist(row: MonthRow, override?: Partial<Draft>) {
    const draft = { ...valuesOf(row), ...override };
    const amount = Number(draft.amount);
    const deduction = Number(draft.deduction || "0");
    const bonus = Number(draft.bonus || "0");
    if (draft.amount.trim() === "" || [amount, deduction, bonus].some((value) => !Number.isFinite(value) || value < 0)) {
      notify(labels.invalid);
      return false;
    }
    const base = row.amount == null ? DEFAULT_STIPEND_BASE : row.amount;
    const dirty = amount !== base || deduction !== row.deduction || bonus !== row.bonus || draft.notes !== row.notes || statusOf(row) !== (row.id ? row.status : "PENDING");
    if (!dirty) return true;
    setBusy(row.studentId);
    const data = new FormData();
    data.set("studentId", row.studentId);
    data.set("period", period);
    data.set("amount", String(amount));
    data.set("deduction", String(deduction));
    data.set("bonus", String(bonus));
    data.set("notes", draft.notes);
    data.set("status", statusOf(row));
    const result = await saveMonthStipendAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return false;
    }
    notify(labels.saved);
    router.refresh();
    return true;
  }

  async function remove(row: MonthRow) {
    if (!row.id || !window.confirm(labels.confirmDelete)) return;
    setBusy(row.id);
    const data = new FormData();
    data.set("id", row.id);
    const result = await deleteStipendAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(result?.success || labels.saved);
    router.refresh();
  }

  async function applyExample() {
    const amount = Number(example);
    const ids = [...selected];
    if (!Number.isFinite(amount) || amount < 0 || ids.length === 0) return;
    setBusy("apply");
    const data = new FormData();
    data.set("period", period);
    data.set("amount", String(amount));
    for (const id of ids) data.append("studentId", id);
    const result = await applyMonthAmountAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(labels.saved);
    router.refresh();
  }

  async function approveSelected() {
    const ids = visible.filter((row) => selected.has(row.studentId) && row.id && statusOf(row) === "PENDING").map((row) => row.id);
    if (ids.length === 0) return;
    setBusy("bulk");
    const data = new FormData();
    for (const id of ids) data.append("id", id);
    const result = await bulkApproveStipendsAction(null, data);
    setBusy(null);
    notify(result?.error || fill(labels.approvedMany, { n: Number(result?.success ?? 0) }));
    if (!result?.error) router.refresh();
  }

  async function paySelected() {
    const ids = visible.filter((row) => selected.has(row.studentId) && row.id && statusOf(row) === "APPROVED").map((row) => row.id);
    if (ids.length === 0) return;
    setBusy("pay");
    const data = new FormData();
    for (const id of ids) data.append("id", id);
    const result = await bulkPayStipendsAction(null, data);
    setBusy(null);
    notify(result?.error || fill(labels.paidMany, { n: Number(result?.success ?? 0) }));
    if (!result?.error) router.refresh();
  }

  const monthTotal = visible.reduce((sum, row) => sum + (row.id ? netOf(row) ?? row.finalAmount ?? 0 : 0), 0);
  const assigned = summary.reduce((sum, row) => sum + row.assigned, 0);
  const paid = summary.reduce((sum, row) => sum + row.paid, 0);

  if (mode === "own") {
    const received = ownRows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amount, 0);
    return (
      <div className="grid gap-3">
        <p className="text-sm text-slate-500">{labels.totalPaid} <Ltr className="font-semibold text-slate-900 tabular-nums">{formatMoney(received, locale)}</Ltr></p>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {ownRows.length === 0 ? <li className="px-4 py-6 text-sm text-slate-500">{labels.none}</li> : null}
          {ownRows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
              <span>
                <Ltr>{row.periodLabel}</Ltr>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {labels.base} <Ltr className="tabular-nums">{formatMoney(row.base, locale)}</Ltr>
                  {" · "}{labels.deduction} <Ltr className="tabular-nums">{formatMoney(row.deduction, locale)}</Ltr>
                  {" · "}{labels.bonus} <Ltr className="tabular-nums">{formatMoney(row.bonus, locale)}</Ltr>
                </span>
                {row.paidLabel ? <span className="mt-0.5 block text-xs text-slate-500">{labels.paidOn} <Ltr>{row.paidLabel}</Ltr></span> : null}
                {row.notes ? <span className="mt-0.5 block text-xs text-slate-500">{row.notes}</span> : null}
              </span>
              <span className="flex items-center gap-2"><Ltr className="tabular-nums">{formatMoney(row.amount, locale)}</Ltr><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[row.status])}>{labels.statuses[row.status]}</span></span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link href={`/stipends?period=${period}`} aria-current={view === "month" ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs font-medium", view === "month" ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>{labels.monthView}</Link>
        <Link href="/stipends?view=summary" aria-current={view === "summary" ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs font-medium", view === "summary" ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>{labels.summary}</Link>
      </div>

      {view === "month" ? <MonthNavigator period={period} locale={locale} monthLabel={labels.month} previousLabel={labels.previousMonth} nextLabel={labels.nextMonth} /> : null}

      <div className="sticky top-16 z-20 -mx-4 mb-3 flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 lg:max-w-sm lg:flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="h-9 ps-9" />
          </label>
          {view === "month" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" onClick={approveSelected} disabled={busy === "bulk" || selected.size === 0} className="h-9 px-3 text-xs">{labels.bulkApprove}</Button>
              <Button type="button" variant="outline" onClick={paySelected} disabled={busy === "pay" || selected.size === 0} className="h-9 px-3 text-xs">{labels.bulkPay}</Button>
              <Input type="number" min={0} step="0.01" value={example} onChange={(event) => setExample(event.target.value)} placeholder={labels.example} aria-label={labels.example} className="h-9 w-28" />
              <Button type="button" variant="outline" disabled={busy === "apply" || selected.size === 0 || example.trim() === ""} onClick={applyExample} className="h-9 px-3 text-xs">{labels.apply}</Button>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {view === "month" ? (
            <>
              {labels.formula}
              <span className="ms-2 font-medium text-slate-700">{labels.monthTotal} <Ltr className="tabular-nums">{formatMoney(monthTotal, locale)}</Ltr></span>
            </>
          ) : (
            <span>{labels.totalGiven} <Ltr className="tabular-nums">{formatMoney(assigned, locale)}</Ltr> · {labels.totalPaid} <Ltr className="tabular-nums">{formatMoney(paid, locale)}</Ltr> · {labels.waiting} <Ltr className="tabular-nums">{formatMoney(Math.max(0, assigned - paid), locale)}</Ltr></span>
          )}
        </p>
      </div>

      {view === "summary" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="h-8">
                <th className="px-3 text-start font-medium">{labels.name}</th>
                <th className="px-3 text-start font-medium">{labels.months}</th>
                <th className="px-3 text-start font-medium">{labels.totalGiven}</th>
                <th className="px-3 text-start font-medium">{labels.totalPaid}</th>
                <th className="px-3 text-start font-medium">{labels.waiting}</th>
              </tr>
            </thead>
            <tbody>
              {visibleSummary.map((row) => (
                <tr key={row.studentId} className="h-9 border-t border-slate-100">
                  <td className="px-3 font-medium">{row.name}</td>
                  <td className="px-3"><Ltr className="tabular-nums">{row.months}</Ltr></td>
                  <td className="px-3"><Ltr className="tabular-nums">{formatMoney(row.assigned, locale)}</Ltr></td>
                  <td className="px-3"><Ltr className="tabular-nums">{formatMoney(row.paid, locale)}</Ltr></td>
                  <td className="px-3"><Ltr className="tabular-nums">{formatMoney(Math.max(0, row.assigned - row.paid), locale)}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSummary.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{labels.none}</p> : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr className="h-8">
                <th className="w-10 px-2 text-start font-medium">
                  <input ref={allRef} type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.length > 0 && visible.every((row) => selected.has(row.studentId))} className="size-3.5" />
                </th>
                <th className="px-2 text-start font-medium">{labels.name}</th>
                <th className="px-2 text-start font-medium">{labels.base}</th>
                <th className="px-2 text-start font-medium">{labels.deduction}</th>
                <th className="px-2 text-start font-medium">{labels.bonus}</th>
                <th className="px-2 text-start font-medium">{labels.net}</th>
                <th className="px-2 text-start font-medium">{labels.status}</th>
                <th className="w-10 px-2 text-center font-medium">{labels.notes}</th>
                <th className="w-16 px-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const draft = valuesOf(row);
                const status = statusOf(row);
                const dirty = rowDirty(row);
                const working = busy === row.studentId || busy === row.id;
                const net = netOf(row);
                const bank = [row.bankName, row.bankBranch, row.bankAccount].filter(Boolean).join(" · ");
                return (
                  <tr key={row.studentId} className="border-t border-slate-100">
                    <td className="px-2">
                      <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => toggle(row.studentId)} aria-label={labels.select} className="size-3.5" />
                    </td>
                    <td className="max-w-[16rem] px-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-800">{letters(row.name)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium leading-4">{row.name}</span>
                          {row.nationalId ? <Ltr className="block text-[11px] leading-4 text-slate-500 tabular-nums">{row.nationalId}</Ltr> : null}
                          {bank ? <Ltr className="block truncate text-[11px] leading-4 text-slate-400 tabular-nums">{bank}</Ltr> : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" min={0} step="0.01" value={draft.amount} disabled={working} aria-label={labels.base} className="h-8 w-[5.5rem] px-2" onChange={(event) => patch(row, { amount: event.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" min={0} step="0.01" value={draft.deduction} disabled={working} aria-label={labels.deduction} className="h-8 w-20 px-2" onChange={(event) => patch(row, { deduction: event.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" min={0} step="0.01" value={draft.bonus} disabled={working} aria-label={labels.bonus} className="h-8 w-20 px-2" onChange={(event) => patch(row, { bonus: event.target.value })} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <Ltr className={cn("font-semibold tabular-nums", row.id ? "text-slate-900" : "text-slate-400")}>{net == null ? "—" : formatMoney(net, locale)}</Ltr>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={labels.status}
                        value={status}
                        disabled={working}
                        onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.studentId]: event.target.value as Status }))}
                        className={cn("h-8 rounded-full border-0 px-2 text-xs font-medium", STATUS_TONE[status])}
                      >
                        {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((value) => <option key={value} value={value}>{labels.statuses[value]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 text-center">
                      <button type="button" aria-label={labels.notes} disabled={working} onClick={() => setNoteFor(row.studentId)} className={cn("inline-grid size-8 place-items-center rounded-full hover:bg-slate-100", draft.notes.trim() ? "text-orange-500" : "text-slate-400")}>
                        <MessageCircle className="size-4" />
                      </button>
                    </td>
                    <td className="px-1 text-end">
                      <div className="flex items-center justify-end">
                        <button type="button" aria-label={labels.save ?? labels.post} disabled={working || !dirty} onClick={() => persist(row)} className={cn("inline-grid size-8 place-items-center rounded-full", dirty ? "text-sky-700 hover:bg-sky-50" : "text-transparent")}>
                          <Check className="size-4" />
                        </button>
                        <button type="button" aria-label={labels.remove} disabled={!row.id || working} onClick={() => remove(row)} className="inline-grid size-8 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{needle ? labels.noMatches : labels.none}</p> : null}
        </div>
      )}

      <NoteDialog
        row={rows.find((row) => row.studentId === noteFor) ?? null}
        notes={(() => { const row = rows.find((item) => item.studentId === noteFor); return row ? valuesOf(row).notes : ""; })()}
        labels={labels}
        onClose={() => setNoteFor(null)}
        onSave={async (notes) => {
          const row = rows.find((item) => item.studentId === noteFor);
          if (!row) return;
          patch(row, { notes });
          const saved = await persist(row, { notes });
          if (saved) setNoteFor(null);
        }}
      />
      {toast ? <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div> : null}
    </div>
  );
}

function MonthNavigator({
  period,
  locale,
  monthLabel,
  previousLabel,
  nextLabel,
}: {
  period: string;
  locale: Locale;
  monthLabel: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, ACADEMIC_STIPEND_PERIODS.indexOf(period as (typeof ACADEMIC_STIPEND_PERIODS)[number]));
  const current = ACADEMIC_STIPEND_PERIODS[index] ?? ACADEMIC_STIPEND_PERIODS[0];
  const title = monthTitle(current, locale);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function go(next: string) {
    setOpen(false);
    router.push(`/stipends?period=${next}`);
  }

  return (
    <div ref={rootRef} className="mb-3 flex justify-center">
      <div className="relative">
      <div className="inline-flex h-10 items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
        <button type="button" aria-label={previousLabel} disabled={index === 0} onClick={() => go(ACADEMIC_STIPEND_PERIODS[index - 1])} className="grid size-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30">
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
        <button type="button" aria-label={monthLabel} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="min-w-44 px-2 text-sm font-medium">
          {title.name} <Ltr className="text-slate-500 tabular-nums">({title.numeric})</Ltr>
        </button>
        <button type="button" aria-label={nextLabel} disabled={index === ACADEMIC_STIPEND_PERIODS.length - 1} onClick={() => go(ACADEMIC_STIPEND_PERIODS[index + 1])} className="grid size-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
      </div>
      {open ? (
        <ul className="absolute top-11 left-1/2 z-30 max-h-64 w-56 -translate-x-1/2 overflow-auto rounded-2xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {ACADEMIC_STIPEND_PERIODS.map((value) => {
            const item = monthTitle(value, locale);
            const active = value === current;
            return (
              <li key={value}>
                <button type="button" onClick={() => go(value)} className={cn("flex w-full items-center justify-between px-3 py-1.5 text-start hover:bg-slate-50", active && "bg-sky-50 font-medium text-sky-900")}>
                  <span>{item.name}</span>
                  <Ltr className="text-xs text-slate-500 tabular-nums">{item.numeric}</Ltr>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      </div>
    </div>
  );
}

function NoteDialog({
  row,
  notes,
  labels,
  onClose,
  onSave,
}: {
  row: MonthRow | null;
  notes: string;
  labels: StipendLabels;
  onClose: () => void;
  onSave: (notes: string) => void;
}) {
  const [text, setText] = useState(notes);
  useEffect(() => setText(notes), [notes, row?.studentId]);
  return (
    <Dialog.Root open={row != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 w-auto rounded-2xl bg-white p-4 shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-80 md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-semibold">{labels.notes}</Dialog.Title>
            <Dialog.Close className="rounded-lg px-2 text-slate-500 hover:bg-slate-100" aria-label={labels.close}>×</Dialog.Close>
          </div>
          {row ? <Dialog.Description className="mb-2 text-xs text-slate-500">{row.name}</Dialog.Description> : null}
          <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label={labels.notes} className="h-24 w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <Button type="button" className="mt-2 h-9 w-full" onClick={() => onSave(text)}>{labels.save ?? labels.post}</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
