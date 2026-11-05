"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type DriveAccess, type DriveVisibility } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canEditDrive, grantMatches, type DriveViewer } from "@/lib/drive-access";
import type { ActionState } from "@/lib/types";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { applySheetRows, syncRealRoster } from "@/server/roster-sync";
import type { SheetColumn, SheetRow } from "@/lib/sheet-types";
import { fromCsv, fromXlsx, toCsv, toXlsx } from "@/server/sheets";

const EDITORS: Permission[] = ["manage_users_and_roles", "manage_attendance", "manage_stipends", "manage_courses"];
const VISIBILITIES = new Set<DriveVisibility>(["MANAGERS_ONLY", "ALL_STUDENTS", "SPECIFIC_COURSES", "SPECIFIC_STUDENTS"]);
const ACCESS_LEVELS = new Set<DriveAccess>(["VIEW", "EDIT"]);

async function viewerFor(session: { id: string; permissions: string[] }): Promise<DriveViewer> {
  const staff = hasAnyPermission(session.permissions, EDITORS);
  if (staff) return { staff: true, userId: session.id, courseIds: [] };
  const rows = await getPrisma().courseEnrollment.findMany({ where: { userId: session.id }, select: { courseId: true } });
  return { staff: false, userId: session.id, courseIds: rows.map((row) => row.courseId) };
}

async function requireEditor() {
  const session = await requireUser();
  if (!hasAnyPermission(session.permissions, EDITORS)) {
    return null;
  }
  return session;
}

function asColumns(value: unknown): SheetColumn[] {
  if (!Array.isArray(value)) return [];
  return value.filter((column): column is SheetColumn => {
    if (!column || typeof column !== "object") return false;
    const record = column as SheetColumn;
    return typeof record.key === "string" && typeof record.label === "string";
  });
}

function asRows(value: unknown): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is SheetRow => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

async function persistSheet(slug: string, columns: SheetColumn[], rows: SheetRow[]) {
  const session = await requireUser();
  const db = getPrisma();
  const file = await db.driveFile.findUnique({ where: { slug } });
  if (!file || file.kind !== "SHEET") return { error: "missing" as const };
  if (!canEditDrive(file, await viewerFor(session))) return { error: "forbidden" as const };
  await db.driveFile.update({
    where: { id: file.id },
    data: {
      columns: columns as Prisma.InputJsonValue,
      rows: rows as Prisma.InputJsonValue,
    },
  });
  if (file.syncKey) await applySheetRows(db, rows);
  revalidatePath("/files");
  revalidatePath(`/files/${slug}`);
  revalidatePath("/students");
  revalidatePath("/stipends");
  return { error: null };
}

export async function syncRosterAction(): Promise<{ error: string | null; summary?: string }> {
  const editor = await requireEditor();
  if (!editor) return { error: "forbidden" };
  const summary = await syncRealRoster(getPrisma());
  revalidatePath("/files");
  revalidatePath("/students");
  revalidatePath("/courses");
  revalidatePath("/attendance");
  revalidatePath("/stipends");
  return { error: null, summary: `${summary.cohort2026 + summary.cohort2025}` };
}

export async function saveSheetAction(slug: string, columns: SheetColumn[], rows: SheetRow[]) {
  return persistSheet(slug, columns, rows);
}

export async function importSheetAction(slug: string, filename: string, base64: string) {
  const session = await requireUser();
  const db = getPrisma();
  const file = await db.driveFile.findUnique({ where: { slug } });
  if (!file || file.kind !== "SHEET") return { error: "missing" as const };
  if (!canEditDrive(file, await viewerFor(session))) return { error: "forbidden" as const };
  const columns = asColumns(file.columns);
  const lower = filename.toLowerCase();
  const parsed = lower.endsWith(".xlsx") || lower.endsWith(".xls")
    ? await fromXlsx(Buffer.from(base64, "base64"), columns)
    : fromCsv(Buffer.from(base64, "base64").toString("utf8"), columns);
  return persistSheet(slug, parsed.columns, parsed.rows);
}

export async function exportSheetAction(slug: string, format: "csv" | "xlsx") {
  const session = await requireUser();
  const db = getPrisma();
  const file = await db.driveFile.findUnique({ where: { slug } });
  if (!file || file.kind !== "SHEET") return { error: "missing" as const };
  const viewer = await viewerFor(session);
  if (!grantMatches(file, viewer)) return { error: "forbidden" as const };
  const columns = asColumns(file.columns);
  const rows = asRows(file.rows);
  if (format === "csv") {
    return { error: null, filename: `${file.name}.csv`, mime: "text/csv;charset=utf-8", base64: Buffer.from(toCsv(columns, rows), "utf8").toString("base64") };
  }
  const buffer = await toXlsx(columns, rows);
  return { error: null, filename: `${file.name}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: buffer.toString("base64") };
}

export async function saveUploadAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const filename = String(formData.get("filename") ?? "").trim();
  const status = String(formData.get("status") ?? "missing");
  const uploaded = status === "uploaded";
  const db = getPrisma();
  const file = await db.driveFile.findUnique({ where: { slug } });
  if (!file || file.kind !== "PDF_UPLOAD") return { error: "missing" };
  if (!canEditDrive(file, await viewerFor(session))) return { error: "forbidden" };
  await db.driveFile.update({
    where: { id: file.id },
    data: { body: uploaded ? "uploaded" : "missing", linkUrl: filename || null },
  });
  if (file.studentId) {
    await db.studentProfile.updateMany({
      where: { userId: file.studentId },
      data: { hasBankConfirmation: uploaded },
    });
    await db.driveFile.updateMany({
      where: { studentId: file.studentId, kind: "PDF_UPLOAD" },
      data: { body: uploaded ? "uploaded" : "missing" },
    });
    if (filename) {
      await db.driveFile.update({ where: { id: file.id }, data: { linkUrl: filename } });
    }
  }
  revalidatePath("/files");
  revalidatePath(`/files/${slug}`);
  if (file.studentId) revalidatePath(`/students/${file.studentId}`);
  revalidatePath("/students");
  return { success: "saved" };
}

export async function setDriveAccessAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const editor = await requireEditor();
  if (!editor) return { error: "forbidden" };
  const kind = String(formData.get("kind") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const visibility = String(formData.get("visibility") ?? "");
  const access = String(formData.get("access") ?? "");
  if ((kind !== "folder" && kind !== "file") || !slug || !VISIBILITIES.has(visibility as DriveVisibility) || !ACCESS_LEVELS.has(access as DriveAccess)) {
    return { error: "invalid" };
  }
  const allowedUserIds = [...new Set(formData.getAll("userId").map(String).filter(Boolean))];
  const allowedCourseIds = [...new Set(formData.getAll("courseId").map(String).filter(Boolean))];
  const data = {
    visibility: visibility as DriveVisibility,
    access: access as DriveAccess,
    allowedUserIds: visibility === "SPECIFIC_STUDENTS" ? allowedUserIds : [],
    allowedCourseIds: visibility === "SPECIFIC_COURSES" ? allowedCourseIds : [],
  };
  const db = getPrisma();
  if (kind === "folder") {
    const folder = await db.driveFolder.findUnique({ where: { slug }, select: { id: true } });
    if (!folder) return { error: "missing" };
    await db.driveFolder.update({ where: { id: folder.id }, data });
  } else {
    const file = await db.driveFile.findUnique({ where: { slug }, select: { id: true } });
    if (!file) return { error: "missing" };
    await db.driveFile.update({ where: { id: file.id }, data });
  }
  revalidatePath("/files");
  if (kind === "file") revalidatePath(`/files/${slug}`);
  return { success: "saved" };
}
