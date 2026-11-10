export function arabicLabel(value: string) {
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => /[\u0600-\u06FF]/.test(part)) ?? value;
}

export function studentFoodName(person: { nameAr?: string | null; nameHe?: string | null; firstName: string; lastName: string }) {
  const arabic = person.nameAr?.trim();
  if (arabic) return arabic;
  const hebrew = person.nameHe?.trim();
  if (hebrew) return hebrew;
  return `${person.firstName} ${person.lastName}`.trim();
}

export const FOOD_ADDITIONS = [
  "حمص",
  "طحينة",
  "اليفاييم",
  "ملفوف أبيض",
  "مخلل",
  "زيتون",
  "كتشب",
  "تشيلي",
  "روتوفيم",
  "بجيت",
  "خبز أسود",
  "بهار بيتسا",
] as const;

export const CHIPS_WITH = "مع بطاطا";
export const CHIPS_WITHOUT = "بدون بطاطا";

export function additionNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(oneLine).filter(Boolean);
}

function oneLine(value: string | null | undefined) {
  return value?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function whatsappBold(value: string) {
  const text = value.replaceAll("*", "").trim();
  return text ? `*${text}*` : "";
}

export function foodOrderLine(name: string, item: string, additions: string[], notes: string | null | undefined) {
  const extras = additions.map(oneLine).filter(Boolean);
  const chips = extras.filter((entry) => entry === CHIPS_WITH || entry === CHIPS_WITHOUT);
  const toppings = extras.filter((entry) => entry !== CHIPS_WITH && entry !== CHIPS_WITHOUT);
  const details = [whatsappBold(arabicLabel(item)), ...toppings.map(arabicLabel), ...chips, oneLine(notes)].filter(Boolean);
  return `${name} - ${details.join(", ")}`;
}

export function foodClipboard(
  orders: { name: string; item: string; additions: string[]; notes?: string | null; sortOrder?: number }[],
  missing: string[],
) {
  const groups = new Map<string, { sort: number; lines: string[] }>();
  for (const order of orders) {
    const key = arabicLabel(order.item);
    const group = groups.get(key) ?? { sort: order.sortOrder ?? groups.size, lines: [] };
    group.lines.push(foodOrderLine(order.name, order.item, order.additions, order.notes));
    groups.set(key, group);
  }
  const blocks = [...groups.values()]
    .sort((a, b) => a.sort - b.sort || a.lines[0].localeCompare(b.lines[0], "ar"))
    .map((group) => group.lines.join("\n"));
  const waiting = [...new Set(missing.map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  if (waiting.length > 0) blocks.push(waiting.join("\n"));
  return blocks.filter(Boolean).join("\n---------\n");
}

export function pollIsOpen(status: string, closesAt: Date, now = new Date()) {
  return status === "OPEN" && closesAt.getTime() > now.getTime();
}
