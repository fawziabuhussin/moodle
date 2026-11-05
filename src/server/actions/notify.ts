"use server";

import { revalidatePath } from "next/cache";
import type { NotificationPriority } from "@prisma/client";
import { getLocale, requirePermission, requireUser } from "@/lib/auth";
import { field } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { notifyUsers, recipientIdsForAudience } from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

export async function sendBroadcastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("send_global_notifications");
  const dict = getDictionary(await getLocale());
  const audience = field(formData, "audience");
  const title = field(formData, "title");
  const body = field(formData, "body");
  const priority = field(formData, "priority") || "NORMAL";
  if (!title || !body || !["NORMAL", "IMPORTANT", "URGENT"].includes(priority)) return { error: dict.errors.invalid };
  if (!["ALL_USERS", "ALL_STUDENTS", "ALL_TEACHERS", "COURSE", "INDIVIDUAL"].includes(audience)) return { error: dict.errors.invalid };
  const courseId = field(formData, "courseId") || null;
  const userId = field(formData, "userId") || null;
  const recipientIds = await recipientIdsForAudience(audience as "ALL_USERS" | "ALL_STUDENTS" | "ALL_TEACHERS" | "COURSE" | "INDIVIDUAL", {
    courseId,
    userId,
  });
  if (recipientIds.length === 0) return { error: dict.errors.invalid };
  await notifyUsers({
    recipientIds,
    title,
    body,
    priority: priority as NotificationPriority,
    audience: audience as "ALL_USERS" | "ALL_STUDENTS" | "ALL_TEACHERS" | "COURSE" | "INDIVIDUAL",
    courseId,
    createdById: session.id,
    linkUrl: "/notifications",
  });
  revalidatePath("/notifications");
  return { success: dict.notifications.sent };
}

export async function markNotificationReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  await getPrisma().userNotification.updateMany({
    where: { id, userId: session.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { success: dict.common.saved };
}

export async function markAllNotificationsReadAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  void prev;
  void formData;
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  await getPrisma().userNotification.updateMany({
    where: { userId: session.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { success: dict.common.saved };
}
