"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BadgeCheck, Banknote, BarChart3, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Hourglass, Loader2, MessageCircle, Search, Trash2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  PENDING: "bg-slate-100 text-slate-700 ring-slate-200",
  APPROVED: "bg-sky-50 text-sky-800 ring-sky-200",
  PAID: "bg-lime-50 text-lime-800 ring-lime-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_FILL: Record<Status, string> = {
  PENDING: "bg-slate-400",
  APPROVED: "bg-sky-500",
  PAID: "bg-lime-500",
  CANCELLED: "bg-rose-400",
};

const STATUSES = ["PENDING", "APPROVED", "PAID", "CANCELLED"] as const;

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
  const posted = rows.filter((row) => row.id);
  const statusCounts = STATUSES.map((status) => ({ status, count: posted.filter((row) => row.status === status).length }));
  const notPosted = rows.length - posted.length;
  const selectedCount = visible.filter((row) => selected.has(row.studentId)).length;

  if (mode === "own") {
    const received = ownRows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amount, 0);
    const expected = ownRows.filter((row) => row.status !== "CANCELLED").reduce((sum, row) => sum + row.amount, 0);
    const ratio = expected > 0 ? Math.min(1, received / expected) : 0;
    return (
      <div className="mx-auto grid max-w-3xl gap-4">
        <section className="bg-ink relative isolate overflow-hidden rounded-[2rem] p-5 text-white shadow-[0_24px_60px_-24px_rgb(11_16_32/0.65)] md:p-7">
          <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div aria-hidden className="absolute -top-24 -end-16 -z-10 size-72 rounded-full bg-lime-400/20 blur-3xl" />
          <Wallet aria-hidden strokeWidth={1.2} className="absolute -end-6 -bottom-8 -z-10 size-44 text-white/[0.06]" />
          <p className="text-sm font-semibold text-slate-300">{labels.totalPaid}</p>
          <Ltr className="mt-1 block text-4xl font-extrabold tracking-tight md:text-5xl">{formatMoney(received, locale)}</Ltr>
          <div className="mt-5 flex max-w-sm items-center gap-3">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-500" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%` }} />
            </span>
            <Ltr className="text-xs font-bold text-slate-300">{formatMoney(expected, locale)}</Ltr>
          </div>
          <p className="mt-2 text-xs text-slate-400"><Ltr>{ownRows.length}</Ltr> {labels.months}</p>
        </section>
        {ownRows.length === 0 ? <Empty>{labels.none}</Empty> : null}
        <ul className="entilaka-stagger grid gap-2.5">
          {ownRows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm", row.status === "PAID" ? "bg-gradient-to-br from-lime-400 to-lime-600" : row.status === "APPROVED" ? "bg-gradient-to-br from-sky-400 to-sky-600" : row.status === "CANCELLED" ? "bg-gradient-to-br from-rose-400 to-rose-600" : "bg-gradient-to-br from-slate-300 to-slate-500")}>
                <CalendarDays className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <Ltr className="text-base font-bold text-slate-900">{row.periodLabel}</Ltr>
                  <StatusPill status={row.status} label={labels.statuses[row.status]} />
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{labels.base} <Ltr>{formatMoney(row.base, locale)}</Ltr></span>
                  {row.deduction ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">− <Ltr>{formatMoney(row.deduction, locale)}</Ltr></span> : null}
                  {row.bonus ? <span className="rounded-full bg-lime-50 px-2 py-0.5 text-lime-700">+ <Ltr>{formatMoney(row.bonus, locale)}</Ltr></span> : null}
                </span>
                {row.paidLabel ? <span className="mt-1.5 block text-xs text-slate-500">{labels.paidOn} <Ltr>{row.paidLabel}</Ltr></span> : null}
                {row.notes ? <span className="mt-1.5 block rounded-xl bg-orange-50/70 px-2.5 py-1.5 text-xs text-slate-600">{row.notes}</span> : null}
              </span>
              <Ltr className="shrink-0 text-lg font-extrabold text-slate-900">{formatMoney(row.amount, locale)}</Ltr>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-fit gap-1 rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-xs backdrop-blur">
          <Link href={`/stipends?period=${period}`} aria-current={view === "month" ? "page" : undefined} className={cn(SEGMENT, view === "month" ? SEGMENT_ON : SEGMENT_OFF)}><CalendarDays className="size-4" />{labels.monthView}</Link>
          <Link href="/stipends?view=summary" aria-current={view === "summary" ? "page" : undefined} className={cn(SEGMENT, view === "summary" ? SEGMENT_ON : SEGMENT_OFF)}><BarChart3 className="size-4" />{labels.summary}</Link>
        </div>
        {view === "month" ? <MonthNavigator period={period} locale={locale} monthLabel={labels.month} previousLabel={labels.previousMonth} nextLabel={labels.nextMonth} /> : null}
      </div>

      {view === "month" ? (
        <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="bg-ink relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-20px_rgb(11_16_32/0.6)]">
            <div aria-hidden className="absolute -top-16 -end-10 -z-10 size-48 rounded-full bg-sky-500/25 blur-3xl" />
            <Wallet aria-hidden strokeWidth={1.2} className="absolute -end-4 -bottom-6 -z-10 size-32 text-white/[0.07]" />
            <p className="text-xs font-semibold text-slate-400">{labels.monthTotal}</p>
            <Ltr className="mt-1 block text-3xl font-extrabold tracking-tight md:text-4xl">{formatMoney(monthTotal, locale)}</Ltr>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{labels.formula}</p>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
            <span className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {statusCounts.map(({ status, count }) => (rows.length && count ? <span key={status} className={STATUS_FILL[status]} style={{ width: `${(count / rows.length) * 100}%` }} /> : null))}
            </span>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {statusCounts.map(({ status, count }) => (
                <div key={status} className="rounded-2xl bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200/60 sm:px-3 sm:py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><span className={cn("size-2 rounded-full", STATUS_FILL[status])} />{labels.statuses[status]}</span>
                  <Ltr className="mt-0.5 block text-xl font-extrabold text-slate-900">{count}</Ltr>
                </div>
              ))}
              <div className="rounded-2xl border border-dashed border-slate-200 px-2.5 py-2 sm:px-3 sm:py-2.5">
                <span className="text-[11px] font-semibold text-slate-500">{labels.notPosted}</span>
                <Ltr className="mt-0.5 block text-xl font-extrabold text-slate-400">{notPosted}</Ltr>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Wallet} tone="from-sky-400 to-sky-600" label={labels.totalGiven} value={formatMoney(assigned, locale)} />
          <SummaryTile icon={BadgeCheck} tone="from-lime-400 to-lime-600" label={labels.totalPaid} value={formatMoney(paid, locale)} ratio={assigned > 0 ? paid / assigned : 0} />
          <SummaryTile icon={Hourglass} tone="from-orange-400 to-orange-600" label={labels.waiting} value={formatMoney(Math.max(0, assigned - paid), locale)} />
        </section>
      )}

      <div className="sticky top-[4.5rem] z-20">
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="h-11 rounded-2xl bg-white/90 ps-10 shadow-sm backdrop-blur md:max-w-md" />
        </label>
      </div>

      {view === "summary" ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50/80 text-xs">
              <tr className="h-11">
                <th className="px-4 text-start">{labels.name}</th>
                <th className="px-3 text-start">{labels.months}</th>
                <th className="px-3 text-start">{labels.totalGiven}</th>
                <th className="px-3 text-start">{labels.totalPaid}</th>
                <th className="px-3 text-start">{labels.waiting}</th>
              </tr>
            </thead>
            <tbody>
              {visibleSummary.map((row) => {
                const ratio = row.assigned > 0 ? row.paid / row.assigned : 0;
                return (
                  <tr key={row.studentId} className="border-t border-slate-100">
                    <td className="px-4 py-2.5"><Person name={row.name} /></td>
                    <td className="px-3"><Ltr className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{row.months}</Ltr></td>
                    <td className="px-3"><Ltr className="font-semibold">{formatMoney(row.assigned, locale)}</Ltr></td>
                    <td className="px-3">
                      <Ltr className="font-semibold text-lime-700">{formatMoney(row.paid, locale)}</Ltr>
                      <span className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-lime-500" style={{ width: `${ratio * 100}%` }} /></span>
                    </td>
                    <td className="px-3"><Ltr className={cn("font-semibold", row.assigned - row.paid > 0 ? "text-orange-600" : "text-slate-400")}>{formatMoney(Math.max(0, row.assigned - row.paid), locale)}</Ltr></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleSummary.length === 0 ? <Empty>{labels.none}</Empty> : null}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm md:block">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-slate-50/80 text-[11px]">
                <tr className="h-11">
                  <th className="w-12 ps-4 pe-2 text-start">
                    <input ref={allRef} type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.length > 0 && visible.every((row) => selected.has(row.studentId))} className="size-4" />
                  </th>
                  <th className="px-2 text-start">{labels.name}</th>
                  <th className="px-2 text-start">{labels.base}</th>
                  <th className="px-2 text-start">{labels.deduction}</th>
                  <th className="px-2 text-start">{labels.bonus}</th>
                  <th className="px-2 text-start">{labels.net}</th>
                  <th className="px-2 text-start">{labels.status}</th>
                  <th className="w-10 px-2 text-center">{labels.notes}</th>
                  <th className="w-20 pe-4" />
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
                  const picked = selected.has(row.studentId);
                  return (
                    <tr key={row.studentId} className={cn("border-t border-slate-100", picked && "bg-sky-50/60", dirty && "bg-orange-50/50 shadow-[inset_3px_0_0_var(--color-orange-400)] rtl:shadow-[inset_-3px_0_0_var(--color-orange-400)]")}>
                      <td className="ps-4 pe-2">
                        <input type="checkbox" checked={picked} onChange={() => toggle(row.studentId)} aria-label={labels.select} className="size-4" />
                      </td>
                      <td className="max-w-[17rem] px-2 py-2.5"><Person name={row.name} lines={[row.nationalId, bank]} /></td>
                      <td className="px-2 py-1"><Input type="number" min={0} step="0.01" value={draft.amount} disabled={working} aria-label={labels.base} className="h-9 w-24 px-2 font-semibold" onChange={(event) => patch(row, { amount: event.target.value })} /></td>
                      <td className="px-2 py-1"><Input type="number" min={0} step="0.01" value={draft.deduction} disabled={working} aria-label={labels.deduction} className="h-9 w-20 px-2 text-rose-700" onChange={(event) => patch(row, { deduction: event.target.value })} /></td>
                      <td className="px-2 py-1"><Input type="number" min={0} step="0.01" value={draft.bonus} disabled={working} aria-label={labels.bonus} className="h-9 w-20 px-2 text-lime-700" onChange={(event) => patch(row, { bonus: event.target.value })} /></td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <Ltr className={cn("text-[15px] font-extrabold", row.id ? "text-slate-900" : "text-slate-400")}>{net == null ? "—" : formatMoney(net, locale)}</Ltr>
                        {row.id ? null : <span className="block text-[10px] font-semibold text-slate-400">{labels.notPosted}</span>}
                      </td>
                      <td className="px-2 py-1"><StatusSelect value={status} disabled={working} labels={labels} onChange={(value) => setStatusDrafts((current) => ({ ...current, [row.studentId]: value }))} /></td>
                      <td className="px-2 text-center">
                        <button type="button" aria-label={labels.notes} title={draft.notes || labels.notes} disabled={working} onClick={() => setNoteFor(row.studentId)} className={cn("relative inline-grid size-9 place-items-center rounded-xl transition-colors hover:bg-slate-100", draft.notes.trim() ? "text-orange-500" : "text-slate-400")}>
                          <MessageCircle className="size-4" />
                          {draft.notes.trim() ? <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-orange-500" /> : null}
                        </button>
                      </td>
                      <td className="pe-4 text-end">
                        <RowActions dirty={dirty} working={working} canRemove={Boolean(row.id)} labels={labels} onSave={() => persist(row)} onRemove={() => remove(row)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 ? <Empty>{needle ? labels.noMatches : labels.none}</Empty> : null}
          </div>

          <div className="grid gap-2.5 md:hidden">
            {visible.length > 0 ? (
              <label className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-500">
                <input type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.every((row) => selected.has(row.studentId))} className="size-4" />
                {labels.select}
              </label>
            ) : null}
            {visible.length === 0 ? <Empty>{needle ? labels.noMatches : labels.none}</Empty> : null}
            {visible.map((row) => {
              const draft = valuesOf(row);
              const status = statusOf(row);
              const dirty = rowDirty(row);
              const working = busy === row.studentId || busy === row.id;
              const net = netOf(row);
              const picked = selected.has(row.studentId);
              return (
                <article key={row.studentId} className={cn("rounded-3xl border bg-white p-3.5 shadow-sm transition-colors", picked ? "border-sky-300 bg-sky-50/40" : dirty ? "border-orange-300" : "border-slate-200/80")}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={picked} onChange={() => toggle(row.studentId)} aria-label={labels.select} className="mt-2.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1"><Person name={row.name} lines={[row.nationalId]} /></div>
                    <div className="text-end">
                      <Ltr className={cn("block text-lg font-extrabold", row.id ? "text-slate-900" : "text-slate-400")}>{net == null ? "—" : formatMoney(net, locale)}</Ltr>
                      {row.id ? null : <span className="block text-[10px] font-semibold text-slate-400">{labels.notPosted}</span>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <label className="grid gap-1 text-[10px] font-semibold text-slate-500">{labels.base}<Input type="number" min={0} step="0.01" value={draft.amount} disabled={working} className="h-10 px-2 font-semibold" onChange={(event) => patch(row, { amount: event.target.value })} /></label>
                    <label className="grid gap-1 text-[10px] font-semibold text-slate-500">{labels.deduction}<Input type="number" min={0} step="0.01" value={draft.deduction} disabled={working} className="h-10 px-2 text-rose-700" onChange={(event) => patch(row, { deduction: event.target.value })} /></label>
                    <label className="grid gap-1 text-[10px] font-semibold text-slate-500">{labels.bonus}<Input type="number" min={0} step="0.01" value={draft.bonus} disabled={working} className="h-10 px-2 text-lime-700" onChange={(event) => patch(row, { bonus: event.target.value })} /></label>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusSelect value={status} disabled={working} labels={labels} onChange={(value) => setStatusDrafts((current) => ({ ...current, [row.studentId]: value }))} />
                    <button type="button" aria-label={labels.notes} disabled={working} onClick={() => setNoteFor(row.studentId)} className={cn("inline-grid size-9 place-items-center rounded-xl ring-1 ring-slate-200", draft.notes.trim() ? "bg-orange-50 text-orange-500" : "text-slate-400")}>
                      <MessageCircle className="size-4" />
                    </button>
                    <div className="ms-auto"><RowActions dirty={dirty} working={working} canRemove={Boolean(row.id)} labels={labels} onSave={() => persist(row)} onRemove={() => remove(row)} /></div>
                  </div>
                </article>
              );
            })}
          </div>

          {selectedCount > 0 ? (
            <div className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:start-72 md:end-0 md:bottom-6 md:px-8">
              <div className="glass-dark entilaka-rise mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-3xl border border-white/10 p-2 text-white shadow-2xl">
                <span className="inline-flex h-9 items-center gap-2 rounded-2xl bg-white/10 px-3 text-sm font-bold">
                  <Ltr>{selectedCount}</Ltr>
                  <button type="button" aria-label={labels.close ?? "×"} onClick={() => setSelected(new Set())} className="grid size-5 place-items-center rounded-full text-slate-300 hover:bg-white/15 hover:text-white"><X className="size-3.5" /></button>
                </span>
                <Button type="button" size="sm" onClick={approveSelected} disabled={busy === "bulk"} className="h-9 rounded-2xl px-3"><BadgeCheck className="size-4" />{labels.bulkApprove}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={paySelected} disabled={busy === "pay"} className="h-9 rounded-2xl bg-lime-500 px-3 text-white hover:bg-lime-400 hover:text-white"><Banknote className="size-4" />{labels.bulkPay}</Button>
                <span className="ms-auto flex items-center gap-1.5">
                  <Input type="number" min={0} step="0.01" value={example} onChange={(event) => setExample(event.target.value)} placeholder={labels.example} aria-label={labels.example} className="h-9 w-28 rounded-2xl border-white/15 bg-white/10 text-white placeholder:text-slate-400" />
                  <Button type="button" size="sm" variant="ghost" disabled={busy === "apply" || example.trim() === ""} onClick={applyExample} className="h-9 rounded-2xl bg-white/10 px-3 text-white ring-1 ring-white/15 hover:bg-white/20">{labels.apply}</Button>
                </span>
              </div>
            </div>
          ) : null}
        </>
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
      {toast ? <div className="entilaka-rise fixed inset-x-0 top-20 z-50 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">{toast}</div> : null}
    </div>
  );
}

const SEGMENT = "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors";
const SEGMENT_ON = "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(13_114_184/0.6)]";
const SEGMENT_OFF = "text-slate-500 hover:bg-slate-100 hover:text-slate-800";

function Person({ name, lines = [] }: { name: string; lines?: string[] }) {
  const extra = lines.filter(Boolean);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-sky-600 to-lime-500 text-[11px] font-bold text-white ring-2 ring-white">{letters(name)}</span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-slate-900">{name}</span>
        {extra.map((line) => <Ltr key={line} className="block truncate text-[11px] leading-4 text-slate-400">{line}</Ltr>)}
      </span>
    </span>
  );
}

function StatusPill({ status, label }: { status: Status; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1", STATUS_TONE[status])}>
      <span className={cn("size-1.5 rounded-full", STATUS_FILL[status])} />
      {label}
    </span>
  );
}

function StatusSelect({ value, disabled, labels, onChange }: { value: Status; disabled: boolean; labels: StipendLabels; onChange: (value: Status) => void }) {
  return (
    <span className={cn("relative inline-flex h-9 items-center rounded-full ring-1", STATUS_TONE[value])}>
      <span aria-hidden className={cn("pointer-events-none absolute start-3 size-1.5 rounded-full", STATUS_FILL[value])} />
      <select
        aria-label={labels.status}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Status)}
        className="h-9 cursor-pointer appearance-none rounded-full bg-transparent ps-6 pe-7 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {STATUSES.map((status) => <option key={status} value={status}>{labels.statuses[status]}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-2.5 size-3.5 opacity-60" />
    </span>
  );
}

function RowActions({ dirty, working, canRemove, labels, onSave, onRemove }: { dirty: boolean; working: boolean; canRemove: boolean; labels: StipendLabels; onSave: () => void; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={labels.save ?? labels.post}
        title={labels.save ?? labels.post}
        disabled={working || !dirty}
        onClick={onSave}
        className={cn("inline-grid size-9 place-items-center rounded-xl transition-all", dirty ? "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(13_114_184/0.7)] hover:from-sky-400" : "text-slate-200")}
      >
        {working ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      <button type="button" aria-label={labels.remove} title={labels.remove} disabled={!canRemove || working} onClick={onRemove} className="inline-grid size-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30">
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}

function SummaryTile({ icon: Icon, tone, label, value, ratio }: { icon: typeof Wallet; tone: string; label: string; value: string; ratio?: number }) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
      <span className={cn("grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm", tone)}><Icon className="size-5" /></span>
      <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
      <Ltr className="mt-0.5 block text-2xl font-extrabold tracking-tight text-slate-900">{value}</Ltr>
      {ratio != null ? (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-lime-500" style={{ width: `${Math.min(1, ratio) * 100}%` }} /></span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="bg-dots-dark grid place-items-center gap-3 rounded-3xl px-4 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><Wallet className="size-5" /></span>
      <p className="text-sm text-slate-500">{children}</p>
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
    <div ref={rootRef} className="flex justify-center md:justify-end">
      <div className="relative">
      <div className="inline-flex h-11 items-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
        <button type="button" aria-label={previousLabel} disabled={index === 0} onClick={() => go(ACADEMIC_STIPEND_PERIODS[index - 1])} className="grid size-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30">
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
        <button type="button" aria-label={monthLabel} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 hover:bg-slate-50">
          <CalendarDays className="size-4 text-sky-600" />{title.name} <Ltr className="text-xs font-semibold text-slate-400">{title.numeric}</Ltr>
          <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
        </button>
        <button type="button" aria-label={nextLabel} disabled={index === ACADEMIC_STIPEND_PERIODS.length - 1} onClick={() => go(ACADEMIC_STIPEND_PERIODS[index + 1])} className="grid size-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
      </div>
      {open ? (
        <ul className="entilaka-rise absolute top-12 left-1/2 z-30 max-h-72 w-60 -translate-x-1/2 overflow-auto rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-xl">
          {ACADEMIC_STIPEND_PERIODS.map((value) => {
            const item = monthTitle(value, locale);
            const active = value === current;
            return (
              <li key={value}>
                <button type="button" onClick={() => go(value)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-start hover:bg-slate-50", active && "bg-sky-50 font-bold text-sky-800")}>
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
        <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 w-auto rounded-3xl bg-white p-5 shadow-2xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-96 md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Dialog.Title className="flex items-center gap-2 text-base font-bold"><span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white"><MessageCircle className="size-4" /></span>{labels.notes}</Dialog.Title>
            <Dialog.Close className="grid size-8 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={labels.close}><X className="size-4" /></Dialog.Close>
          </div>
          {row ? <Dialog.Description className="mb-2 text-xs text-slate-500">{row.name}</Dialog.Description> : null}
          <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label={labels.notes} className="h-28 w-full resize-none rounded-2xl border border-input bg-white px-3 py-2 text-base outline-none focus-visible:border-sky-400 focus-visible:ring-4 focus-visible:ring-sky-400/15" />
          <Button type="button" className="mt-3 h-11 w-full" onClick={() => onSave(text)}>{labels.save ?? labels.post}</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
