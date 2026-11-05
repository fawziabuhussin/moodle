"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Input } from "@/components/ui/input";
import type { SheetColumn, SheetRow } from "@/lib/sheet-types";
import { exportSheetAction, importSheetAction, saveSheetAction } from "@/server/actions/files";

const LTR_KEYS = new Set(["badgeId", "nationalId", "phone", "email", "dob", "bankAccount", "bankBranch"]);

function download(filename: string, mime: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SheetEditor({
  slug,
  columns,
  initialRows,
  canEdit,
  profiles,
  copy,
}: {
  slug: string;
  columns: SheetColumn[];
  initialRows: SheetRow[];
  canEdit: boolean;
  profiles: Record<string, string>;
  copy: {
    search: string;
    addRow: string;
    save: string;
    saving: string;
    saved: string;
    exportCsv: string;
    exportXlsx: string;
    importFile: string;
    rows: string;
    empty: string;
    noMatches: string;
    readOnly: string;
    profile: string;
  };
}) {
  const linkStudents = colsHaveIdentity(columns);
  const [cols] = useState(columns);
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !needle || Object.values(row).join(" ").toLowerCase().includes(needle));
  }, [rows, query]);

  function updateCell(index: number, key: string, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    const blank: SheetRow = {};
    for (const column of cols) blank[column.key] = "";
    setRows((current) => [...current, blank]);
  }

  function save() {
    startTransition(async () => {
      const result = await saveSheetAction(slug, cols, rows);
      setNote(result.error ?? copy.saved);
    });
  }

  function downloadAs(format: "csv" | "xlsx") {
    startTransition(async () => {
      const result = await exportSheetAction(slug, format);
      if (result.error || !result.base64 || !result.filename || !result.mime) {
        setNote(result.error ?? "export");
        return;
      }
      download(result.filename, result.mime, result.base64);
    });
  }

  function onImport(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.slice(result.indexOf(",") + 1) : result;
      startTransition(async () => {
        const saved = await importSheetAction(slug, file.name, base64);
        if (saved.error) {
          setNote(saved.error);
          return;
        }
        window.location.reload();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="min-w-0 flex-1 basis-full sm:basis-auto sm:max-w-xs" />
        <span className="text-xs text-slate-500">{shown.length} {copy.rows}</span>
        <button type="button" onClick={() => downloadAs("csv")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">{copy.exportCsv}</button>
        <button type="button" onClick={() => downloadAs("xlsx")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">{copy.exportXlsx}</button>
        {canEdit ? (
          <>
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
              {copy.importFile}
              <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => onImport(event.target.files?.[0])} />
            </label>
            <button type="button" onClick={addRow} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">{copy.addRow}</button>
            <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-bright disabled:opacity-60">{pending ? copy.saving : copy.save}</button>
          </>
        ) : (
          <span className="text-xs text-slate-500">{copy.readOnly}</span>
        )}
      </div>
      {note ? <p className="text-sm text-slate-600">{note}</p> : null}
      <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr className="h-9">
              {linkStudents ? <th className="sticky start-0 z-10 bg-slate-50 px-2 text-start font-medium">{copy.profile}</th> : null}
              {cols.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-2 text-start font-medium">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row, index }) => {
              const profileId = profileFor(row, profiles);
              return (
                <tr key={index} className="h-11 border-t border-slate-100">
                  {linkStudents ? (
                    <td className="sticky start-0 z-10 border-e border-slate-200 bg-white px-2">
                      {profileId ? (
                        <Link href={`/students/${profileId}`} className="whitespace-nowrap text-xs font-medium text-primary">{copy.profile}</Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ) : null}
                  {cols.map((column) => (
                    <td key={column.key} className="px-1">
                      {canEdit ? (
                        <input
                          value={row[column.key] ?? ""}
                          dir={LTR_KEYS.has(column.key) ? "ltr" : undefined}
                          onChange={(event) => updateCell(index, column.key, event.target.value)}
                          className="h-8 w-full min-w-28 rounded-md bg-transparent px-1.5 tabular-nums outline-none focus:bg-sky-50"
                        />
                      ) : (
                        <span className="block min-w-28 px-1.5">{cellText(column.key, row[column.key])}</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">{query ? copy.noMatches : copy.empty}</p> : null}
      </div>
    </div>
  );
}

function colsHaveIdentity(columns: SheetColumn[]) {
  return columns.some((column) => column.key === "badgeId" || column.key === "nationalId");
}

function profileFor(row: SheetRow, profiles: Record<string, string>) {
  const badge = row.badgeId?.trim();
  if (badge && profiles[`badge:${badge}`]) return profiles[`badge:${badge}`];
  const nationalId = row.nationalId?.trim();
  if (nationalId && profiles[`nid:${nationalId}`]) return profiles[`nid:${nationalId}`];
  return null;
}

function cellText(key: string, value: string | undefined) {
  const text = value?.trim() ? value : "—";
  if (!LTR_KEYS.has(key) || text === "—") return text;
  return <Ltr>{text}</Ltr>;
}
