import Link from "next/link";
import { safeHttpUrl } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { SheetEditor } from "@/components/files/sheet-editor";
import { PageHeader } from "@/components/page-header";
import { Input, Select } from "@/components/ui/input";
import { getLocale, requireUser } from "@/lib/auth";
import { canEditDrive, grantMatches, type DriveViewer } from "@/lib/drive-access";
import { filesCopy } from "@/lib/files-copy";
import type { SheetColumn, SheetRow } from "@/lib/sheet-types";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";
import { saveUploadAction } from "@/server/actions/files";

const EDITORS: Permission[] = ["manage_users_and_roles", "manage_attendance", "manage_stipends", "manage_courses"];
const PROFILE_VIEW: Permission[] = ["manage_users_and_roles", "manage_stipends", "manage_private_sessions", "manage_attendance", "manage_exams_and_grades", "manage_courses"];

function columnsOf(value: unknown): SheetColumn[] {
  if (!Array.isArray(value)) return [];
  return value.filter((column): column is SheetColumn => {
    if (!column || typeof column !== "object") return false;
    const record = column as SheetColumn;
    return typeof record.key === "string" && typeof record.label === "string";
  });
}

function rowsOf(value: unknown): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is SheetRow => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

async function studentProfileMap(columns: SheetColumn[], rows: SheetRow[], session: SessionUser) {
  const keys = new Set(columns.map((column) => column.key));
  const badges = keys.has("badgeId") ? unique(rows.map((row) => row.badgeId?.trim() ?? "")) : [];
  const nationalIds = keys.has("nationalId") ? unique(rows.map((row) => row.nationalId?.trim() ?? "")) : [];
  const filters = [
    badges.length > 0 ? { hardwareBadgeId: { in: badges } } : null,
    nationalIds.length > 0 ? { studentProfile: { is: { nationalId: { in: nationalIds } } } } : null,
  ].filter((filter) => filter != null);
  if (filters.length === 0) return {};
  const users = await getPrisma().user.findMany({
    where: { OR: filters },
    select: { id: true, hardwareBadgeId: true, studentProfile: { select: { nationalId: true } } },
  });
  const canOpen = hasAnyPermission(session.permissions, PROFILE_VIEW);
  const profiles: Record<string, string> = {};
  for (const user of users) {
    if (!canOpen && user.id !== session.id) continue;
    if (user.hardwareBadgeId) profiles[`badge:${user.hardwareBadgeId}`] = user.id;
    const nationalId = user.studentProfile?.nationalId?.trim();
    if (nationalId) profiles[`nid:${nationalId}`] = user.id;
  }
  return profiles;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export default async function DriveFilePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireUser();
  const copy = filesCopy(await getLocale());
  const staff = hasAnyPermission(session.permissions, EDITORS);
  const { slug } = await params;
  const db = getPrisma();
  const [file, folders, enrollments] = await Promise.all([
    db.driveFile.findUnique({ where: { slug }, include: { folder: true } }),
    db.driveFolder.findMany({ select: { id: true, parentId: true, slug: true, name: true } }),
    staff ? Promise.resolve([]) : db.courseEnrollment.findMany({ where: { userId: session.id }, select: { courseId: true } }),
  ]);
  const viewer: DriveViewer = { staff, userId: session.id, courseIds: enrollments.map((row) => row.courseId) };
  if (!file || !grantMatches(file, viewer)) notFound();
  const editable = canEditDrive(file, viewer);
  const columns = columnsOf(file.columns);
  const rows = rowsOf(file.rows);
  const profiles = file.kind === "SHEET" ? await studentProfileMap(columns, rows, session) : {};
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const crumbs: { slug: string; name: string }[] = [];
  let cursor = byId.get(file.folderId);
  while (cursor) {
    crumbs.unshift({ slug: cursor.slug, name: cursor.name });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return (
    <div className="min-w-0">
      <PageHeader title={file.name} description={file.folder.name} />
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {crumbs.map((crumb) => (
          <span key={crumb.slug} className="flex min-w-0 items-center gap-2">
            <Link href={`/files?folder=${crumb.slug}`} className="truncate text-primary">{crumb.name}</Link>
            <span className="text-slate-300">/</span>
          </span>
        ))}
        <span className="truncate font-semibold">{file.name}</span>
      </nav>
      {file.kind === "SHEET" ? (
        <SheetEditor slug={file.slug} columns={columns} initialRows={rows} canEdit={editable} profiles={profiles} copy={copy} />
      ) : null}
      {file.kind === "DOC" ? (
        <article className="whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-card p-4 text-sm leading-7 shadow-sm">{file.body}</article>
      ) : null}
      {file.kind === "FORM_LINK" ? (
        <article className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card p-4 text-sm shadow-sm">
          <p className="whitespace-pre-wrap">{file.body}</p>
          {safeHttpUrl(file.linkUrl) ? <a href={safeHttpUrl(file.linkUrl)!} target="_blank" rel="noopener noreferrer" className="break-all text-sky-800">{file.linkUrl}</a> : null}
        </article>
      ) : null}
      {file.kind === "PDF_UPLOAD" ? (
        <article className="grid max-w-lg gap-3 rounded-2xl border border-slate-200/80 bg-card p-4 text-sm shadow-sm">
          <p>{file.body === "uploaded" ? copy.uploaded : copy.missing}</p>
          {file.linkUrl ? <p className="break-all text-slate-600">{file.linkUrl}</p> : null}
          {editable ? (
            <ActionForm action={saveUploadAction} className="grid gap-3">
              <input type="hidden" name="slug" value={file.slug} />
              <label className="grid gap-1">
                {copy.uploadName}
                <Input name="filename" defaultValue={file.linkUrl ?? ""} />
              </label>
              <label className="grid gap-1">
                {copy.pdf}
                <Select name="status" defaultValue={file.body === "uploaded" ? "uploaded" : "missing"}>
                  <option value="uploaded">{copy.uploaded}</option>
                  <option value="missing">{copy.missing}</option>
                </Select>
              </label>
              <SubmitButton label={copy.save} pendingLabel={copy.saving} />
            </ActionForm>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
