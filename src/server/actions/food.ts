"use server";

import { revalidatePath } from "next/cache";
import { activeStudentWhere } from "@/lib/cohort";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames } from "@/lib/food";
import { field, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { notifyUsers } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function canManage(permissions: readonly string[], roleSlugs: readonly string[]) {
  return roleSlugs.includes("manager") || hasPermission(permissions, "manage_food_polls");
}

function refreshFood(pollId?: string) {
  revalidatePath("/food");
  revalidatePath("/food/manager");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  if (pollId) revalidatePath(`/food/poll/${pollId}`);
}

export async function openFoodPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canManage(session.permissions, session.roleSlugs)) return { error: dict.errors.forbidden };
  const restaurantId = field(formData, "restaurantId");
  const minutes = Number(field(formData, "minutes") || "15");
  if (!restaurantId || !Number.isFinite(minutes) || minutes < 1 || minutes > 180) return { error: dict.errors.invalid };
  const db = getPrisma();
  const restaurant = await db.restaurant.findFirst({ where: { id: restaurantId, isActive: true } });
  if (!restaurant) return { error: dict.errors.notFound };
  const now = new Date();
  await db.foodPoll.updateMany({
    where: { status: "OPEN" },
    data: { status: "CLOSED", closesAt: now },
  });
  const poll = await db.foodPoll.create({
    data: {
      restaurantId,
      status: "OPEN",
      openedAt: now,
      closesAt: new Date(now.getTime() + minutes * 60_000),
      createdById: session.id,
    },
  });
  const students = await db.user.findMany({
    where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
    select: { id: true },
  });
  await notifyUsers({
    recipientIds: students.map((student) => student.id),
    title: "🍔 فتح باب طلبات الطعام! / נפתחה הזמנת אוכל!",
    body: `لديك ${minutes} دقيقة لاختيار وجبتك من ${restaurant.name}. / יש לך ${minutes} דקות לבחור מנה מ-${restaurant.name}.`,
    priority: "IMPORTANT",
    audience: "ALL_STUDENTS",
    createdById: session.id,
    linkUrl: `/food/poll/${poll.id}`,
  });
  refreshFood(poll.id);
  return { success: dict.food.opened };
}

export async function extendFoodPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canManage(session.permissions, session.roleSlugs)) return { error: dict.errors.forbidden };
  const id = field(formData, "pollId");
  if (!id) return { error: dict.errors.invalid };
  const poll = await getPrisma().foodPoll.findUnique({ where: { id } });
  if (!poll) return { error: dict.errors.notFound };
  const base = Math.max(poll.closesAt.getTime(), Date.now());
  await getPrisma().foodPoll.update({
    where: { id },
    data: { status: "OPEN", closesAt: new Date(base + 5 * 60_000) },
  });
  refreshFood(id);
  return { success: dict.food.extended };
}

export async function closeFoodPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canManage(session.permissions, session.roleSlugs)) return { error: dict.errors.forbidden };
  const id = field(formData, "pollId");
  if (!id) return { error: dict.errors.invalid };
  const now = new Date();
  await getPrisma().foodPoll.updateMany({ where: { id }, data: { status: "CLOSED", closesAt: now } });
  refreshFood(id);
  return { success: dict.food.closedNow };
}

export async function submitFoodOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!session.roleSlugs.includes("student")) return { error: dict.errors.forbidden };
  const pollId = field(formData, "pollId");
  const menuItemId = field(formData, "menuItemId");
  const notes = optional(formData, "notes");
  const additions = additionNames(formData.getAll("additions"));
  if (!pollId || !menuItemId) return { error: dict.errors.invalid };
  const db = getPrisma();
  const poll = await db.foodPoll.findUnique({ where: { id: pollId } });
  if (!poll || poll.status !== "OPEN" || poll.closesAt.getTime() <= Date.now()) return { error: dict.food.closedNow };
  const item = await db.menuItem.findFirst({ where: { id: menuItemId, restaurantId: poll.restaurantId } });
  if (!item) return { error: dict.errors.invalid };
  const known = await db.menuAddition.findMany({ where: { menuItemId }, select: { name: true } });
  const allowed = new Set(known.map((addition) => addition.name));
  const chosen = additions.filter((name) => allowed.has(name));
  await db.foodOrder.upsert({
    where: { pollId_studentId: { pollId, studentId: session.id } },
    create: { pollId, studentId: session.id, menuItemId, additions: chosen, notes },
    update: { menuItemId, additions: chosen, notes },
  });
  refreshFood(pollId);
  return { success: dict.food.saved };
}
