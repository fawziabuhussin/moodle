"use client";

import { ChevronRight, ExternalLink, FileSpreadsheet, FileText, Folder, LayoutGrid, Rows3, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { syncRosterAction } from "@/server/actions/files";

export type ExplorerItem = {
  kind: "folder" | "SHEET" | "DOC" | "FORM_LINK" | "PDF_UPLOAD";
  slug: string;
  name: string;
  path: string;
  parentSlug: string | null;
  visibility: "STAFF" | "SHARED";
};

const icons = {
  folder: Folder,
  SHEET: FileSpreadsheet,
  DOC: FileText,
  FORM_LINK: ExternalLink,
  PDF_UPLOAD: Upload,
};

const tones = {
  folder: "bg-amber-50 text-amber-600 ring-amber-100",
  SHEET: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  DOC: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  FORM_LINK: "bg-violet-50 text-violet-600 ring-violet-100",
  PDF_UPLOAD: "bg-sky-50 text-sky-700 ring-sky-100",
};

export function FileExplorer({
  items,
  crumbs,
  currentSlug,
  canEdit,
  copy,
}: {
  items: ExplorerItem[];
  crumbs: { slug: string; name: string }[];
  currentSlug: string;
  canEdit: boolean;
  copy: {
    search: string;
    grid: string;
    table: string;
    empty: string;
    noMatches: string;
    open: string;
    sheet: string;
    doc: string;
    form: string;
    pdf: string;
    folder: string;
    sync: string;
    syncing: string;
    synced: string;
    kind: string;
    items: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"grid" | "table">("grid");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const labels = { folder: copy.folder, SHEET: copy.sheet, DOC: copy.doc, FORM_LINK: copy.form, PDF_UPLOAD: copy.pdf };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.filter((item) => item.parentSlug === currentSlug);
    return items.filter((item) => `${item.name} ${item.path}`.toLowerCase().includes(needle));
  }, [items, query, currentSlug]);

  function sync() {
    startTransition(async () => {
      const result = await syncRosterAction();
      setNote(result.error ? result.error : copy.synced);
    });
  }

  function inside(slug: string) {
    return items.filter((item) => item.parentSlug === slug).length;
  }

  return (
    <div className="grid min-w-0 gap-3">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <span key={crumb.slug} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-slate-300 rtl:rotate-180" /> : null}
            <Link
              href={`/files?folder=${crumb.slug}`}
              className={cn(
                "max-w-[16rem] truncate rounded-full px-2.5 py-1 text-xs transition-colors",
                index === crumbs.length - 1 ? "border border-slate-200 bg-white font-semibold text-slate-900 shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>
      <div className="sticky top-16 z-20 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="ps-9" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button type="button" aria-pressed={mode === "grid"} onClick={() => setMode("grid")} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs", mode === "grid" && "bg-sky-50 font-medium text-primary")}><LayoutGrid className="size-3.5" />{copy.grid}</button>
            <button type="button" aria-pressed={mode === "table"} onClick={() => setMode("table")} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs", mode === "table" && "bg-sky-50 font-medium text-primary")}><Rows3 className="size-3.5" />{copy.table}</button>
          </div>
          {canEdit ? (
            <button type="button" onClick={sync} disabled={pending} className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-bright disabled:opacity-60">
              {pending ? copy.syncing : copy.sync}
            </button>
          ) : null}
        </div>
      </div>
      {note ? <p className="text-sm text-slate-600">{note}</p> : null}
      {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm text-muted-foreground shadow-sm backdrop-blur">{query ? copy.noMatches : copy.empty}</p> : null}
      {mode === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const href = item.kind === "folder" ? `/files?folder=${item.slug}` : `/files/${item.slug}`;
            const count = item.kind === "folder" ? inside(item.slug) : null;
            return (
              <li key={item.slug}>
                <Link href={href} className="flex min-h-[92px] items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <KindBadge kind={item.kind} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {query ? item.path : labels[item.kind]}
                      {count != null ? <> · <Ltr>{count}</Ltr> {copy.items}</> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-slate-50/80 text-xs text-slate-500">
              <tr className="h-9">
                <th className="px-3 text-start font-medium">{copy.open}</th>
                <th className="px-3 text-start font-medium">{copy.kind}</th>
                <th className="px-3 text-start font-medium">{copy.folder}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const href = item.kind === "folder" ? `/files?folder=${item.slug}` : `/files/${item.slug}`;
                const count = item.kind === "folder" ? inside(item.slug) : null;
                return (
                  <tr key={item.slug} className="h-14 border-t border-slate-100 transition-colors hover:bg-slate-50/80">
                    <td className="px-3">
                      <Link href={href} className="flex items-center gap-2 font-medium text-slate-900">
                        <KindBadge kind={item.kind} compact />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 text-slate-500">
                      {labels[item.kind]}
                      {count != null ? <> · <Ltr>{count}</Ltr></> : null}
                    </td>
                    <td className="max-w-[16rem] truncate px-3 text-xs text-slate-400">{item.path}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind, compact = false }: { kind: ExplorerItem["kind"]; compact?: boolean }) {
  const Icon = icons[kind];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl ring-1", tones[kind], compact ? "size-8" : "size-11")}>
      <Icon className={compact ? "size-4" : "size-5"} />
    </span>
  );
}
