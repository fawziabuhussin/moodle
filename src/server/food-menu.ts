import "server-only";

import { PERMISSIONS } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

const RESTAURANT_NAME = "המטבח / مطعم المعهد";

const ADDITIONS = [
  { name: "צ'יפס בצד / بطاطا عجنب", emoji: "🍟" },
  { name: "חמוצים / مخلل", emoji: "🥒" },
  { name: "כרוב לבן / ملفوف أبيض", emoji: "🥬" },
  { name: "חומוס / حمص", emoji: "🫘" },
  { name: "תירס / ذرة", emoji: "🌽" },
  { name: "זיתים / زيتون", emoji: "🫒" },
  { name: "טונה / تونة", emoji: "🐟" },
  { name: "פטריות / فطر", emoji: "🍄" },
  { name: "לחמניה שחורה / لحمنيا سوداء", emoji: "🍞" },
  { name: "צ'ילי מתוק / تشيلي", emoji: "🌶️" },
] as const;

const ITEMS = [
  { name: "שניצל / شنيتسل", emoji: "🍗", category: "main" },
  { name: "חזה עוף / صدر دجاج", emoji: "🍖", category: "main" },
  { name: "פיצה אישית / بيتسا شخصية", emoji: "🍕", category: "main" },
  { name: "טוסט / توست", emoji: "🥪", category: "main" },
  { name: "כריך גבינה / ساندويشة جبنة حلومي", emoji: "🧀", category: "main" },
] as const;

export async function ensureFoodMenu() {
  const db = getPrisma();
  await db.role.updateMany({
    where: { slug: "manager" },
    data: { permissions: [...PERMISSIONS] },
  });

  const existing = await db.restaurant.findFirst({
    where: { name: RESTAURANT_NAME },
    include: { items: { include: { additions: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (existing && existing.items.length > 0) return existing;

  return db.restaurant.create({
    data: {
      name: RESTAURANT_NAME,
      logoIcon: "🍽️",
      isActive: true,
      items: {
        create: ITEMS.map((item, index) => ({
          name: item.name,
          emoji: item.emoji,
          category: item.category,
          sortOrder: index,
          additions: {
            create: ADDITIONS.map((addition, additionIndex) => ({
              name: addition.name,
              emoji: addition.emoji,
              isDefault: false,
              sortOrder: additionIndex,
            })),
          },
        })),
      },
    },
    include: { items: { include: { additions: true }, orderBy: { sortOrder: "asc" } } },
  });
}
