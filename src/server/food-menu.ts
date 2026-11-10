import "server-only";

import { FOOD_ADDITIONS } from "@/lib/food";
import { PERMISSIONS } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

const RESTAURANT_NAME = "המטבח / مطعم المعهد";
export const DEFAULT_MENU_NAME = "القائمة";

const DISHES = [
  { name: "ساندويشه بستراما", emoji: "🥪" },
  { name: "ساندويشه جبنه صفراء", emoji: "🧀" },
  { name: "ساندويشه نقانق", emoji: "🌭" },
  { name: "ساندويشه جبنه حلومي", emoji: "🧀" },
  { name: "توست", emoji: "🥪" },
  { name: "ساندويشه صدر دجاج", emoji: "🍗" },
  { name: "ساندويشه شنيتسل", emoji: "🍗" },
  { name: "ساندويشه كباب", emoji: "🥙" },
  { name: "طابون زعتر شخصي", emoji: "🫓" },
  { name: "بيتسا شخصيه", emoji: "🍕" },
  { name: "سلطه صدر دجاج", emoji: "🥗" },
  { name: "سلطه تونا", emoji: "🥗" },
  { name: "مشولاش", emoji: "🥐" },
] as const;

export function dishEmoji(name: string) {
  return DISHES.find((dish) => dish.name === name)?.emoji ?? "🍽️";
}

export async function ensureFoodMenu() {
  const db = getPrisma();
  await db.role.updateMany({
    where: { slug: "manager" },
    data: { permissions: [...PERMISSIONS] },
  });

  const restaurant = await db.restaurant.findFirst({ where: { name: RESTAURANT_NAME } })
    ?? await db.restaurant.create({ data: { name: RESTAURANT_NAME, logoIcon: "🍽️", isActive: true } });

  const menu = await db.foodMenu.findFirst({ where: { restaurantId: restaurant.id, name: DEFAULT_MENU_NAME } })
    ?? await db.foodMenu.create({ data: { restaurantId: restaurant.id, name: DEFAULT_MENU_NAME } });

  const saved = await db.menuItem.count({ where: { menuId: menu.id, available: true } });
  if (saved === 0) {
    await db.menuItem.createMany({
      data: DISHES.map((dish, index) => ({
        restaurantId: restaurant.id,
        menuId: menu.id,
        name: dish.name,
        emoji: dish.emoji,
        category: "main",
        sortOrder: index,
      })),
    });
  }

  const bare = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, available: true, additions: { none: {} } },
    select: { id: true },
  });
  for (const item of bare) {
    await db.menuAddition.createMany({
      data: FOOD_ADDITIONS.map((name, index) => ({ menuItemId: item.id, name, sortOrder: index })),
    });
  }

  await db.menuItem.deleteMany({
    where: { restaurantId: restaurant.id, menuId: null, orders: { none: {} } },
  });

  return restaurant;
}
