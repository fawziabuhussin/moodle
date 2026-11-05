"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ltr } from "@/components/ltr";
import { Field } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { Locale } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AccountEditor, type AccountDraft } from "@/components/students/account-editor";
import { applyMonthAmountAction, bulkApproveStipendsAction, bulkPayStipendsAction, deleteStipendAction, saveMonthStipendAction, setStipendStatusAction } from "@/server/actions/finance";

type Status = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type MonthRow = {
  id: string;
  studentId: string;
  name: string;
  amount: number | null;
  deduction: number;
  bonus: number;
  finalAmount: number | null;
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
  post: string;
  edit: string;
  notPosted: string;
  net: string;
  remove: string;
  confirmDelete: string;
  invalid: string;
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
  const [statusDrafts, setStatusDrafts] = useState<Record<string, Status>>({});
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [example, setExample] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const signature = rows.map((row) => `${row.studentId}:${row.id}:${row.amount}:${row.deduction}:${row.bonus}:${row.finalAmount}:${row.notes}:${row.status}`).join("|");

  useEffect(() => {
    setOverrides({});
    setStatusDrafts({});
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
    return statusDrafts[row.studentId] ?? overrides[row.id] ?? row.status;
  }

  function rowDirty(row: MonthRow) {
    const draft = draftOf(row);
    const typed = draft.amount.trim();
    const amountDirty = typed === "" ? row.amount != null : Number(typed) !== row.amount;
    const statusDirty = statusOf(row) !== (row.id ? row.status : "PENDING");
    return amountDirty || draft.notes !== row.notes || statusDirty;
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

  async function persist(row: MonthRow) {
    const draft = draftOf(row);
    const amount = Number(draft.amount);
    if (draft.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      notify(labels.invalid);
      return;
    }
    if (!rowDirty(row)) return;
    setBusy(row.studentId);
    const data = new FormData();
    data.set("studentId", row.studentId);
    data.set("period", period);
    data.set("amount", String(amount));
    data.set("notes", draft.notes);
    data.set("status", statusOf(row));
    const result = await saveMonthStipendAction(null, data);
    setBusy(null);
    if (result?.error) {
      notify(result.error);
      return;
    }
    notify(labels.saved);
    router.refresh();
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

  async function setStatus(row: MonthRow, status: Status) {
    if (!row.id) return;
    const previous = statusOf(row);
    setStatusDrafts((current) => {
      const next = { ...current };
      delete next[row.studentId];
      return next;
    });
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

  function netOf(row: MonthRow) {
    const typed = draftOf(row).amount.trim();
    const amount = typed === "" ? null : Number(typed);
    if (amount == null || !Number.isFinite(amount) || amount < 0) return row.finalAmount ?? 0;
    return Math.max(0, amount - row.deduction + row.bonus);
  }

  function accountEditor(row: MonthRow) {
    if (!row.account || !labels.editAccount || !labels.resetPassword || !labels.save || !labels.savingAccount || !labels.close || !labels.email || !labels.phone || !labels.bank || !labels.branch || !labels.accountNumber || !labels.confirmation) return null;
    return (
      <AccountEditor
        account={row.account}
        editLabel={labels.editAccount}
        resetLabel={labels.resetPassword}
        saveLabel={labels.save}
        savingLabel={labels.savingAccount}
        closeLabel={labels.close}
        emailLabel={labels.email}
        phoneLabel={labels.phone}
        bankLabel={labels.bank}
        branchLabel={labels.branch}
        accountLabel={labels.accountNumber}
        confirmationLabel={labels.confirmation}
      />
    );
  }

  const monthTotal = visible.reduce((sum, row) => sum + netOf(row), 0);
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
          <label className="relative min-w-0 lg:flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="ps-9" />
          </label>
          {view === "month" ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:flex">
                <Input type="month" aria-label={labels.month} value={period} onChange={(event) => router.push(`/stipends?period=${event.target.value}`)} className="lg:w-44" />
                <Input type="number" min={0} step="0.01" value={example} onChange={(event) => setExample(event.target.value)} placeholder={labels.example} aria-label={labels.example} className="lg:w-36" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 lg:flex">
                <Button type="button" variant="outline" disabled={busy === "apply" || selected.size === 0 || example.trim() === ""} onClick={applyExample} className="col-span-2 h-9 px-2 text-xs lg:h-10 lg:px-4 lg:text-sm">{labels.apply}</Button>
                <Button type="button" onClick={approveSelected} disabled={busy === "bulk" || selected.size === 0} className="h-9 px-2 text-xs lg:h-10 lg:px-4 lg:text-sm">{labels.bulkApprove}</Button>
                <Button type="button" variant="outline" onClick={paySelected} disabled={busy === "pay" || selected.size === 0} className="h-9 px-2 text-xs lg:h-10 lg:px-4 lg:text-sm">{labels.bulkPay}</Button>
              </div>
            </>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {view === "month" ? labels.formula : null}
          {view === "month" ? <span className="ms-2 font-medium text-slate-700">{labels.monthTotal} <Ltr>{formatMoney(monthTotal, locale)}</Ltr></span> : <span>{labels.totalGiven} <Ltr>{formatMoney(assigned, locale)}</Ltr> · {labels.totalPaid} <Ltr>{formatMoney(paid, locale)}</Ltr> · {labels.waiting} <Ltr>{formatMoney(Math.max(0, assigned - paid), locale)}</Ltr></span>}
        </p>
      </div>

      {view === "summary" ? (
        <>
        <ul className="grid gap-2 md:hidden">
          {visibleSummary.map((row) => (
            <li key={row.studentId} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="font-medium">{row.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                <div><dt>{labels.months}</dt><dd className="font-medium text-slate-900"><Ltr>{row.months}</Ltr></dd></div>
                <div><dt>{labels.totalGiven}</dt><dd className="font-medium text-slate-900"><Ltr>{formatMoney(row.assigned, locale)}</Ltr></dd></div>
                <div><dt>{labels.totalPaid}</dt><dd className="font-medium text-slate-900"><Ltr>{formatMoney(row.paid, locale)}</Ltr></dd></div>
                <div><dt>{labels.waiting}</dt><dd className="font-medium text-slate-900"><Ltr>{formatMoney(Math.max(0, row.assigned - row.paid), locale)}</Ltr></dd></div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
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
        {visibleSummary.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 md:hidden">{labels.none}</p> : null}
        </>
      ) : (
        <>
          <ul className="grid gap-2 md:hidden">
            {visible.map((row) => {
              const draft = draftOf(row);
              const status = statusOf(row);
              const dirty = rowDirty(row);
              const working = busy === row.studentId || busy === row.id;
              const net = netOf(row);
              return (
                <li key={row.studentId} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId); return next; })} aria-label={labels.select} className="mt-1 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-5">{row.name}</span>
                        {row.id ? <Ltr className="shrink-0 text-sm font-semibold">{formatMoney(net, locale)}</Ltr> : <Badge tone="PENDING">{labels.notPosted}</Badge>}
                      </div>
                      {row.accountLine ? <p className="truncate text-[11px] text-slate-500"><Ltr>{row.accountLine}</Ltr></p> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input type="number" min={0} step="0.01" value={draft.amount} disabled={working} aria-label={labels.amount} placeholder={labels.amount} className="h-10" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { notes: draft.notes, amount: event.target.value }}))} />
                    <select aria-label={labels.status} value={status} disabled={working} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.studentId]: event.target.value as Status }))} className="h-10 w-full rounded-xl border border-input bg-card px-2 text-base">
                      {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((value) => <option key={value} value={value}>{labels.statuses[value]}</option>)}
                    </select>
                  </div>
                  <Input value={draft.notes} disabled={working} aria-label={labels.notes} placeholder={labels.notes} className="mt-2 h-10" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { amount: draft.amount, notes: event.target.value }}))} />
                  {row.deduction > 0 || row.bonus > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {labels.deduction} <Ltr>{formatMoney(row.deduction, locale)}</Ltr>
                      {" · "}{labels.bonus} <Ltr>{formatMoney(row.bonus, locale)}</Ltr>
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button type="button" size="sm" disabled={working || !dirty} onClick={() => persist(row)}>{row.id ? labels.save : labels.post}</Button>
                    <StipendEditor row={row} period={period} locale={locale} labels={labels} onDone={(message) => { notify(message); router.refresh(); }} />
                    <Button type="button" size="sm" variant="outline" disabled={!row.id || working || status === "APPROVED" || status === "PAID"} onClick={() => setStatus(row, "APPROVED")}>{labels.approve}</Button>
                    <Button type="button" size="sm" variant="outline" disabled={!row.id || working || status !== "APPROVED"} onClick={() => setStatus(row, "PAID")}>{labels.paid}</Button>
                    <Button type="button" size="sm" variant="outline" disabled={!row.id || working} onClick={() => remove(row)}>{labels.remove}</Button>
                    {accountEditor(row)}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr className="h-9">
                  <th className="w-10 px-3 text-start font-medium">
                    <input ref={allRef} type="checkbox" aria-label={labels.select} onChange={toggleAll} checked={visible.length > 0 && visible.every((row) => selected.has(row.studentId))} className="size-4" />
                  </th>
                  <th className="px-3 text-start font-medium">{labels.name}</th>
                  <th className="px-3 text-start font-medium">{labels.amount}</th>
                  <th className="px-3 text-start font-medium">{labels.notes}</th>
                  <th className="px-3 text-start font-medium">{labels.status}</th>
                  <th className="px-3 text-start font-medium">{labels.net}</th>
                  <th className="px-3 text-start font-medium">{labels.edit}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const draft = draftOf(row);
                  const status = statusOf(row);
                  const dirty = rowDirty(row);
                  const working = busy === row.studentId || busy === row.id;
                  const net = netOf(row);
                  return (
                    <tr key={row.studentId} className="border-t border-slate-100">
                      <td className="px-3 align-top pt-3">
                        <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId); return next; })} aria-label={labels.select} className="size-4" />
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 align-top">
                        <span className="block font-medium">{row.name}</span>
                        {row.accountLine ? <span className="block truncate text-[11px] text-slate-500"><Ltr>{row.accountLine}</Ltr></span> : null}
                        {accountEditor(row)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input type="number" min={0} step="0.01" value={draft.amount} disabled={working} aria-label={labels.amount} placeholder={labels.amount} className="h-9 w-28" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { notes: draft.notes, amount: event.target.value }}))} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input value={draft.notes} disabled={working} aria-label={labels.notes} placeholder={labels.notes} className="h-9 min-w-36" onChange={(event) => setDrafts((current) => ({ ...current, [row.studentId]: { amount: draft.amount, notes: event.target.value }}))} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select aria-label={labels.status} value={status} disabled={working} onChange={(event) => setStatusDrafts((current) => ({ ...current, [row.studentId]: event.target.value as Status }))} className="h-9 rounded-xl border border-input bg-card px-2 text-sm">
                          {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((value) => <option key={value} value={value}>{labels.statuses[value]}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">
                        {row.id ? <Ltr className="font-semibold">{formatMoney(net, locale)}</Ltr> : <Badge tone="PENDING">{labels.notPosted}</Badge>}
                        {row.deduction > 0 || row.bonus > 0 ? (
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {labels.deduction} <Ltr>{formatMoney(row.deduction, locale)}</Ltr>
                            {" · "}{labels.bonus} <Ltr>{formatMoney(row.bonus, locale)}</Ltr>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" disabled={working || !dirty} onClick={() => persist(row)}>{row.id ? labels.save : labels.post}</Button>
                          <StipendEditor row={row} period={period} locale={locale} labels={labels} onDone={(message) => { notify(message); router.refresh(); }} />
                          <Button type="button" size="sm" variant="outline" disabled={!row.id || working || status === "APPROVED" || status === "PAID"} onClick={() => setStatus(row, "APPROVED")}>{labels.approve}</Button>
                          <Button type="button" size="sm" variant="outline" disabled={!row.id || working || status !== "APPROVED"} onClick={() => setStatus(row, "PAID")}>{labels.paid}</Button>
                          <Button type="button" size="sm" variant="outline" disabled={!row.id || working} onClick={() => remove(row)}>{labels.remove}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length === 0 ? <p className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">{needle ? labels.noMatches : labels.none}</p> : null}
        </>
      )}
      {toast ? <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div> : null}
    </div>
  );
}

function StipendEditor({
  row,
  period,
  locale,
  labels,
  onDone,
}: {
  row: MonthRow;
  period: string;
  locale: Locale;
  labels: StipendLabels;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(row.amount == null ? "" : String(row.amount));
  const [deduction, setDeduction] = useState(String(row.deduction));
  const [bonus, setBonus] = useState(String(row.bonus));
  const [notes, setNotes] = useState(row.notes);
  const [status, setStatus] = useState<Status>(row.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const amountValue = Number(amount);
  const deductionValue = Number(deduction || "0");
  const bonusValue = Number(bonus || "0");
  const net = [amountValue, deductionValue, bonusValue].every((value) => Number.isFinite(value) && value >= 0)
    ? Math.max(0, amountValue - deductionValue + bonusValue)
    : null;

  function seed() {
    setAmount(row.amount == null ? "" : String(row.amount));
    setDeduction(String(row.deduction));
    setBonus(String(row.bonus));
    setNotes(row.notes);
    setStatus(row.id ? row.status : "PENDING");
    setError(null);
  }

  async function save() {
    if (amount.trim() === "" || net == null) {
      setError(labels.invalid);
      return;
    }
    setPending(true);
    const data = new FormData();
    data.set("studentId", row.studentId);
    data.set("period", period);
    data.set("amount", String(amountValue));
    data.set("deduction", String(deductionValue));
    data.set("bonus", String(bonusValue));
    data.set("notes", notes);
    data.set("status", status);
    const result = await saveMonthStipendAction(null, data);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDone(labels.saved ?? result?.success ?? "");
  }

  async function remove() {
    if (!row.id || !window.confirm(labels.confirmDelete)) return;
    setPending(true);
    const data = new FormData();
    data.set("id", row.id);
    const result = await deleteStipendAction(null, data);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onDone(result?.success || labels.saved || "");
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) seed(); }}>
      <Dialog.Trigger className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent">
        {labels.edit}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl outline-none backdrop-blur-xl md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[32rem] md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">{row.id ? labels.edit : labels.post}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500">{row.name}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label={labels.close}>×</Dialog.Close>
          </div>
          <div className="grid gap-3">
            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
            <Field label={labels.amount}><Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} dir="ltr" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={labels.deduction}><Input type="number" min={0} step="0.01" value={deduction} onChange={(event) => setDeduction(event.target.value)} dir="ltr" /></Field>
              <Field label={labels.bonus}><Input type="number" min={0} step="0.01" value={bonus} onChange={(event) => setBonus(event.target.value)} dir="ltr" /></Field>
            </div>
            <p className="text-sm text-slate-600">{labels.net} <Ltr className="font-semibold text-slate-900">{net == null ? "—" : formatMoney(net, locale)}</Ltr></p>
            <Field label={labels.notes}><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" /></Field>
            <Field label={labels.status}>
              <select value={status} onChange={(event) => setStatus(event.target.value as Status)} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm">
                {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((value) => <option key={value} value={value}>{labels.statuses[value]}</option>)}
              </select>
            </Field>
            <div className="flex items-center justify-between gap-2">
              {row.id ? <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={remove}>{labels.remove}</Button> : <span />}
              <Button type="button" disabled={pending} onClick={save}>{pending ? labels.saving : row.id ? labels.save : labels.post}</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
