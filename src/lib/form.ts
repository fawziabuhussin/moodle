import { Prisma } from "@prisma/client";

export function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function optional(formData: FormData, key: string) {
  const value = field(formData, key);
  return value ? value : null;
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function lines(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
