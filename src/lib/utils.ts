import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initials(person: { firstName: string; lastName: string }) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function safeNextPath(value: string | null | undefined) {
  // Only same-site paths. Backslashes and control characters are refused because browsers treat a slash followed by a backslash as "//".
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/dashboard";
  }
  return value;
}
