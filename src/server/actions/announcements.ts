"use server";

import { revalidatePath } from "next/cache";
import type { NotificationPriority } from "@prisma/client";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import { field, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { notifyUsers, recipientIdsForAudience } from "@/lib/notifications";
import { hasAnyPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

const PRIORITIES = new Set(["NORMAL", "IMPORTANT", "URGENT"]);

function canPost(permissions: string[]) {
  return hasAnyPermission(permissions, ["post_course_feed", "send_global_notifications", "manage_courses"]);
}

function canModerate(permissions: string[]) {
  return hasAnyPermission(permissions, ["send_global_notifications", "manage_users_and_roles", "manage_courses"]);
}

export async function createAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canPost(session.permissions)) return { error: dict.errors.forbidden };
  const title = field(formData, "title");
  const body = field(formData, "body");
  const priority = field(formData, "priority");
  const courseId = optional(formData, "courseId");
  if (!title || !body || !PRIORITIES.has(priority)) return { error: dict.errors.invalid };
  const db = getPrisma();
  const recipientIds = courseId
    ? await recipientIdsForAudience("COURSE", { courseId })
    : (await db.user.findMany({
        where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
        select: { id: true },
      })).map((row) => row.id);
  await notifyUsers({
    recipientIds,
    title,
    body,
    priority: priority as NotificationPriority,
    audience: courseId ? "COURSE" : "ALL_STUDENTS",
    courseId,
    createdById: session.id,
    linkUrl: "/dashboard",
    isPinned: formData.get("isPinned") === "on",
  });
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: dict.common.saved };
}

export async function toggleAnnouncementPinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canModerate(session.permissions)) return { error: dict.errors.forbidden };
  const id = field(formData, "id");
  if (!id) return { error: dict.errors.invalid };
  const existing = await getPrisma().notification.findUnique({ where: { id }, select: { isPinned: true } });
  if (!existing) return { error: dict.errors.notFound };
  await getPrisma().notification.update({ where: { id }, data: { isPinned: !existing.isPinned } });
  revalidatePath("/dashboard");
  return { success: dict.common.saved };
}

export async function deleteAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canModerate(session.permissions)) return { error: dict.errors.forbidden };
  const id = field(formData, "id");
  if (!id) return { error: dict.errors.invalid };
  await getPrisma().notification.deleteMany({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: dict.common.saved };
}
