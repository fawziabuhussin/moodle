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

export function additionNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function foodOrderLine(name: string, item: string, additions: string[], notes: string | null | undefined) {
  const details = [arabicLabel(item), ...additions.map(arabicLabel), notes?.trim()].filter(Boolean);
  return `${name} - ${details.join(", ")}`;
}

export function pollIsOpen(status: string, closesAt: Date, now = new Date()) {
  return status === "OPEN" && closesAt.getTime() > now.getTime();
}
