"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AccountEditor, type AccountDraft } from "@/components/students/account-editor";
import { applyMonthAmountAction, bulkApproveStipendsAction, bulkPayStipendsAction, saveMonthStipendAction, setStipendStatusAction } from "@/server/actions/finance";

type Status = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type MonthRow = {
  id: string;
  studentId: string;
  name: string;
  amount: number | null;
  notes: string;
  status: Status;
  accountLine?: string;
  account?: AccountDraft;
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
  editAccount?: string;
  resetPassword?: string;
  save?: string;
  savingAccount?: string;
  close?: string;
  email?: string;
  phone?: string;
  bank?: string;
  branch?: string;
  accountNumber?: string;
  confirmation?: string;
};

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
  const [drafts, setDrafts] = useState<Record<string, { amount: string; notes: string }>>({});
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [example, setExample] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const signature = rows.map((row) => `${row.studentId}:${row.id}:${row.amount}:${row.notes}:${row.status}`).join("|");

  useEffect(() => {
    setOverrides({});
    setSelected(new Set());
    setDrafts({});
  }, [signature, view]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => rows.filter((row) => !needle || `${row.name} ${row.accountLine ?? ""}`.toLowerCase().includes(needle)), [needle, rows]);
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

  function draftOf(row: MonthRow) {
    return drafts[row.studentId] ?? { amount: row.amount == null ? "" : String(row.amount), notes: row.notes };
  }

  function statusOf(row: MonthRow): Status {
    return overrides[row.id] ?? row.status;
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

  async function persist(row: MonthRow, amountText: string, notes: string) {
    const amount = amountText.trim() === "" ? row.amount : Number(amountText);
    if (amount == null || !Number.isFinite(amount) || amount < 0) return;
    if (row.amount === amount && row.notes === notes) return;
    setBusy(row.studentId);
    const data = new FormData();
    data.set("studentId", row.studentId);
    data.set("period", period);
    data.set("amount", String(amount));
    data.set("notes", notes);
    const result = await saveMonthStipendAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(labels.saved);
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

  async function setStatus(row: MonthRow, status: Status) {
    if (!row.id) return;
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

  const monthTotal = visible.reduce((sum, row) => {
    const value = Number(draftOf(row).amount);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const assigned = summary.reduce((sum, row) => sum + row.assigned, 0);
  const paid = summary.reduce((sum, row) => sum + row.paid, 0);

  if (mode === "own") {
    const received = ownRows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amount, 0);
    return (
      <div className="grid gap-3">
        <p className="text-sm text-slate-500">{labels.totalPaid} <Ltr className="font-semibold text-slate-900">{formatMoney(received, locale)}</Ltr></p>
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {ownRows.length === 0 ? <li className="px-4 py-6 text-sm text-slate-500">{labels.none}</li> : null}
          {ownRows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
              <span>
                <Ltr>{row.periodLabel}</Ltr>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {labels.base} <Ltr>{formatMoney(row.base, locale)}</Ltr>
                  {" · "}{labels.deduction} <Ltr>{formatMoney(row.deduction, locale)}</Ltr>
                  {" · "}{labels.bonus} <Ltr>{formatMoney(row.bonus, locale)}</Ltr>
                </span>
                {row.paidLabel ? <span className="mt-0.5 block text-xs text-slate-500">{labels.paidOn} <Ltr>{row.paidLabel}</Ltr></span> : null}
                {row.notes ? <span className="mt-0.5 block text-xs text-slate-500">{row.notes}</span> : null}
              </span>
              <span className="flex items-center gap-2"><Ltr>{formatMoney(row.amount, locale)}</Ltr><Badge tone={row.status}>{labels.statuses[row.status]}</Badge></span>
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
      <div className="sticky top-16 z-20 -mx-4 mb-3 flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="ps-9" />
          </label>
          {view === "month" ? (
            <>
              <Input type="month" aria-label={labels.month} value={period} onChange={(event) => router.push(`/stipends?period=${event.target.value}`)} className="lg:w-44" />
              <Input type="number" min={0} step="0.01" value={example} onChange={(event) => setExample(event.target.value)} placeholder={labels.example} aria-label={labels.example} className="lg:w-36" />
              <Button type="button" variant="outline" disabled={busy === "apply" || selected.size === 0 || example.trim() === ""} onClick={applyExample}>{labels.apply}</Button>
              <Button type="button" onClick={approveSelected} disabled={busy === "bulk" || selected.size === 0}>{labels.bulkApprove}</Button>
              <Button type="button" variant="outline" onClick={paySelected} disabled={busy === "pay" || selected.size === 0}>{labels.bulkPay}</Button>
            </>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {view === "month" ? labels.formula : null}
          {view === "month" ? <span className="ms-2 font-medium text-slate-700">{labels.monthTotal} <Ltr>{formatMoney(monthTotal, locale)}</Ltr></span> : <span>{labels.totalGiven} <Ltr>{formatMoney(assigned, locale)}</Ltr> · {labels.totalPaid} <Ltr>{formatMoney(paid, locale)}</Ltr> · {labels.waiting} <Ltr>{formatMoney(Math.max(0, assigned - paid), locale)}</Ltr></span>}
        </p>
      </div>

      {view === "summary" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="h-9">
                <th className="px-3 text-start font-medium">{labels.name}</th>
                <th className="px-3 text-start font-medium">{labels.months}</th>
                <th className="px-3 text-start font-medium">{labels.totalGiven}</th>
                <th className="px-3 text-start font-medium">{labels.totalPaid}</th>
                <th className="px-3 text-start font-medium">{labels.waiting}</th>
              </tr>
            </thead>
            <tbody>
              {visibleSummary.map((row) => (
                <tr key={row.studentId} className="h-12 border-t border-slate-100">
                  <td className="px-3 font-medium">{row.name}</td>
                  <td className="px-3"><Ltr>{row.months}</Ltr></td>
                  <td className="px-3"><Ltr>{formatMoney(row.assigned, locale)}</Ltr></td>
                  <td className="px-3"><Ltr>{formatMoney(row.paid, locale)}</Ltr></td>
                  <td className="px-3"><Ltr>{formatMoney(Math.max(0, row.assigned - row.paid), locale)}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSummary.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{labels.none}</p> : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="h-9">
                <th className="w-10 px-3">
                  <input ref={allRef} type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.length > 0 && visible.every((row) => selected.has(row.studentId))} className="size-4" />
                </th>
                <th className="px-2 text-start font-medium">{labels.name}</th>
                <th className="px-2 text-start font-medium">{labels.amount}</th>
                <th className="px-2 text-start font-medium">{labels.notes}</th>
                <th className="px-2 text-start font-medium">{labels.status}</th>
                <th className="px-3 text-end font-medium">{labels.approve}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const draft = draftOf(row);
                const status = statusOf(row);
                const locked = Boolean(row.id) && status === "PAID";
                return (
                  <tr key={row.studentId} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId); return next; })} aria-label={labels.select} className="size-4" />
                    </td>
                    <td className="max-w-[16rem] px-2 py-1.5">
                      <span className="block truncate font-medium">{row.name}</span>
                      {row.accountLine ? <span className="block truncate text-[11px] text-slate-500"><Ltr>{row.accountLine}</Ltr></span> : null}
                      {row.account && labels.editAccount && labels.resetPassword && labels.save && labels.savingAccount && labels.close && labels.email && labels.phone && labels.bank && labels.branch && labels.accountNumber && labels.confirmation ? (
                        <AccountEditor account={row.account} editLabel={labels.editAccount} resetLabel={labels.resetPassword} saveLabel={labels.save} savingLabel={labels.savingAccount} closeLabel={labels.close} emailLabel={labels.email} phoneLabel={labels.phone} bankLabel={labels.bank} branchLabel={labels.branch} accountLabel={labels.accountNumber} confirmationLabel={labels.confirmation} />
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" min={0} step="0.01" value={draft.amount} disabled={locked || busy === row.studentId} aria-label={labels.amount} className="h-8 w-28" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { notes: draft.notes, amount: event.target.value } }))} onBlur={(event) => persist(row, event.currentTarget.value, draft.notes)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={draft.notes} disabled={busy === row.studentId} aria-label={labels.notes} placeholder={labels.notes} className="h-8 min-w-[10rem]" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { amount: draft.amount, notes: event.target.value } }))} onBlur={(event) => persist(row, draft.amount, event.currentTarget.value)} />
                    </td>
                    <td className="px-2 py-1.5">{row.id ? <Badge tone={status}>{labels.statuses[status]}</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" disabled={!row.id || busy === row.id || status === "APPROVED" || status === "PAID"} onClick={() => setStatus(row, "APPROVED")}>{labels.approve}</Button>
                        <Button type="button" size="sm" variant="outline" disabled={!row.id || busy === row.id || status !== "APPROVED"} onClick={() => setStatus(row, "PAID")}>{labels.paid}</Button>
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
      {toast ? <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div> : null}
    </div>
  );
}
