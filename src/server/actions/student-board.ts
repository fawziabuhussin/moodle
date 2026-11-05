"use server";

import { revalidatePath } from "next/cache";
import { compare } from "bcryptjs";
import { isStudentPortal } from "@/lib/access";
import { getLocale, hashPassword, requireUser } from "@/lib/auth";
import { field, isEmail, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

export async function updateOwnContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!isStudentPortal(session)) return { error: dict.errors.forbidden };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = optional(formData, "phone");
  if (!isEmail(email)) return { error: dict.errors.invalid };
  const db = getPrisma();
  const taken = await db.user.findFirst({ where: { email, NOT: { id: session.id } }, select: { id: true } });
  if (taken) return { error: dict.users.emailTaken };
  await db.user.update({ where: { id: session.id }, data: { email, phone } });
  await db.studentProfile.updateMany({
    where: { userId: session.id },
    data: {
      emergencyContactName: optional(formData, "emergencyContactName"),
      emergencyContactPhone: optional(formData, "emergencyContactPhone"),
    },
  });
  revalidatePath("/student-board");
  return { success: dict.common.saved };
}

export async function updateOwnBankAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!isStudentPortal(session)) return { error: dict.errors.forbidden };
  await getPrisma().studentProfile.updateMany({
    where: { userId: session.id },
    data: {
      bankName: optional(formData, "bankName"),
      bankBranch: optional(formData, "bankBranch"),
      bankAccountNumber: optional(formData, "bankAccountNumber"),
    },
  });
  revalidatePath("/student-board");
  revalidatePath("/students");
  revalidatePath("/stipends");
  return { success: dict.common.saved };
}

export async function changeOwnPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!isStudentPortal(session)) return { error: dict.errors.forbidden };
  const current = field(formData, "currentPassword");
  const next = field(formData, "newPassword");
  if (next.length < 8) return { error: dict.errors.invalid };
  const user = await getPrisma().user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
  if (!user || !(await compare(current, user.passwordHash))) return { error: dict.login.invalid };
  await getPrisma().user.update({ where: { id: session.id }, data: { passwordHash: await hashPassword(next) } });
  revalidatePath("/student-board");
  return { success: dict.common.saved };
}

export async function uploadOwnBankFileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!isStudentPortal(session)) return { error: dict.errors.forbidden };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: dict.errors.invalid };
  const db = getPrisma();
  const folder = await db.driveFolder.upsert({
    where: { slug: "student-personal" },
    update: {},
    create: { slug: "student-personal", name: "קבצים אישיים", visibility: "MANAGERS_ONLY", sortOrder: 9 },
  });
  const slug = `bank-confirm-${session.id}`;
  await db.driveFile.upsert({
    where: { slug },
    update: {
      body: "uploaded",
      linkUrl: file.name,
      studentId: session.id,
      visibility: "SPECIFIC_STUDENTS",
      access: "EDIT",
      allowedUserIds: [session.id],
    },
    create: {
      slug,
      name: "אישור ניהול חשבון",
      folderId: folder.id,
      kind: "PDF_UPLOAD",
      body: "uploaded",
      linkUrl: file.name,
      studentId: session.id,
      visibility: "SPECIFIC_STUDENTS",
      access: "EDIT",
      allowedUserIds: [session.id],
    },
  });
  await db.studentProfile.updateMany({ where: { userId: session.id }, data: { hasBankConfirmation: true } });
  revalidatePath("/student-board");
  revalidatePath("/files");
  return { success: dict.common.saved };
}
