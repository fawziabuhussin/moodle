"use server";

import { revalidatePath } from "next/cache";
import { activeStudentWhere } from "@/lib/cohort";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames, CHIPS_WITH, CHIPS_WITHOUT } from "@/lib/food";
import { field, optional } from "@/lib/form";
import { dishEmoji } from "@/server/food-menu";
import { getDictionary } from "@/lib/i18n";
import { notifyUsers } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function canManage(permissions: readonly string[], roleSlugs: readonly string[]) {
  return roleSlugs.includes("manager") || hasPermission(permissions, "manage_food_polls");
}

function money(value: string | null): number | null | false {
  if (!value) return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) return false;
  return Math.round(amount * 100) / 100;
}

function menuLines(value: string) {
  return value.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const priced = line.match(/^(.*\S)\s*[-–—|]\s*(\d+(?:[.,]\d{1,2})?)\s*$/);
    if (!priced) return { name: line, price: 0 };
    const amount = money(priced[2]);
    return { name: priced[1].trim(), price: amount === false ? 0 : amount ?? 0 };
  }).filter((item) => item.name.length > 0).slice(0, 80);
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
  const menuId = field(formData, "menuId");
  const minutes = Number(field(formData, "minutes") || "15");
  const price = money(optional(formData, "price"));
  if (!restaurantId || !menuId || !Number.isFinite(minutes) || minutes < 1 || minutes > 180 || price === false) return { error: dict.errors.invalid };
  const db = getPrisma();
  const menu = await db.foodMenu.findFirst({
    where: { id: menuId, restaurantId, restaurant: { isActive: true } },
    include: { items: { where: { available: true }, select: { id: true } }, restaurant: { select: { name: true } } },
  });
  if (!menu || menu.items.length === 0) return { error: dict.errors.invalid };
  const now = new Date();
  await db.foodPoll.updateMany({
    where: { status: "OPEN" },
    data: { status: "CLOSED", closesAt: now },
  });
  const poll = await db.foodPoll.create({
    data: {
      restaurantId,
      menuId,
      price,
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
    body: `لديك ${minutes} دقيقة لاختيار وجبتك من ${menu.restaurant.name}. / יש לך ${minutes} דקות לבחור מנה מ-${menu.restaurant.name}.`,
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
  const notes = optional(formData, "notes")?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() || null;
  const additions = additionNames(formData.getAll("additions"));
  if (!pollId || !menuItemId) return { error: dict.errors.invalid };
  const db = getPrisma();
  const poll = await db.foodPoll.findUnique({ where: { id: pollId } });
  if (!poll || poll.status !== "OPEN" || poll.closesAt.getTime() <= Date.now()) return { error: dict.food.closedNow };
  const item = await db.menuItem.findFirst({
    where: { id: menuItemId, restaurantId: poll.restaurantId, available: true, ...(poll.menuId ? { menuId: poll.menuId } : {}) },
  });
  if (!item) return { error: dict.errors.invalid };
  const known = await db.menuAddition.findMany({ where: { menuItemId }, select: { name: true } });
  const allowed = new Set(known.map((addition) => addition.name));
  const chips = additions.filter((name) => name === CHIPS_WITH || name === CHIPS_WITHOUT);
  if (chips.length !== 1) return { error: dict.food.chipsRequired };
  const chosen = [...additions.filter((name) => allowed.has(name) && name !== CHIPS_WITH && name !== CHIPS_WITHOUT), chips[0]];
  await db.foodOrder.upsert({
    where: { pollId_studentId: { pollId, studentId: session.id } },
    create: { pollId, studentId: session.id, menuItemId, additions: chosen, notes },
    update: { menuItemId, additions: chosen, notes },
  });
  refreshFood(pollId);
  return { success: dict.food.saved };
}

export async function saveFoodMenuAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canManage(session.permissions, session.roleSlugs)) return { error: dict.errors.forbidden };
  const restaurantId = field(formData, "restaurantId");
  const requestedId = optional(formData, "menuId");
  const name = field(formData, "name") || dict.food.menu;
  const items = menuLines(String(formData.get("items") ?? ""));
  if (!restaurantId || !name || items.length === 0) return { error: dict.errors.invalid };
  const db = getPrisma();
  const restaurant = await db.restaurant.findFirst({ where: { id: restaurantId, isActive: true }, select: { id: true } });
  if (!restaurant) return { error: dict.errors.notFound };
  const existing = requestedId
    ? await db.foodMenu.findFirst({ where: { id: requestedId, restaurantId } })
    : await db.foodMenu.findFirst({ where: { restaurantId, name } });
  const menu = existing
    ? await db.foodMenu.update({ where: { id: existing.id }, data: { name } })
    : await db.foodMenu.create({ data: { restaurantId, name } });
  const current = await db.menuItem.findMany({ where: { menuId: menu.id }, select: { id: true, name: true, orders: { select: { id: true }, take: 1 } } });
  const kept = new Set<string>();
  for (const [index, item] of items.entries()) {
    const match = current.find((row) => row.name === item.name && !kept.has(row.id));
    if (match) {
      kept.add(match.id);
      await db.menuItem.update({
        where: { id: match.id },
        data: { name: item.name, basePrice: item.price, sortOrder: index, available: true, emoji: dishEmoji(item.name) },
      });
    } else {
      await db.menuItem.create({
        data: {
          restaurantId,
          menuId: menu.id,
          name: item.name,
          emoji: dishEmoji(item.name),
          category: "main",
          basePrice: item.price,
          sortOrder: index,
        },
      });
    }
  }
  const removed = current.filter((row) => !kept.has(row.id));
  const unused = removed.filter((row) => row.orders.length === 0).map((row) => row.id);
  const used = removed.filter((row) => row.orders.length > 0).map((row) => row.id);
  if (unused.length > 0) await db.menuItem.deleteMany({ where: { id: { in: unused } } });
  if (used.length > 0) await db.menuItem.updateMany({ where: { id: { in: used } }, data: { available: false } });
  const additionLines = String(formData.get("additions") ?? "").split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 40);
  const savedItems = await db.menuItem.findMany({ where: { menuId: menu.id, available: true }, select: { id: true } });
  for (const item of savedItems) {
    await db.menuAddition.deleteMany({ where: { menuItemId: item.id } });
    if (additionLines.length > 0) {
      await db.menuAddition.createMany({
        data: additionLines.map((name, index) => ({ menuItemId: item.id, name, sortOrder: index })),
      });
    }
  }
  refreshFood();
  return { success: dict.food.menuSaved };
}
