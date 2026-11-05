import type { Locale } from "@/lib/constants";
import { localeTag } from "@/lib/constants";
import { formatTime } from "@/lib/time";

export function asNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0;
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : 0;
}

export function formatMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, locale: Locale) {
  if (value == null) return "—";
  return new Intl.NumberFormat(localeTag(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatDate(value: Date | string, locale: Locale, timeZone = "UTC") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale: Locale, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${formatDate(date, locale, timeZone)} \u2066${formatTime(date, timeZone)}\u2069`;
}

export function formatMonth(year: number, month: number, locale: Locale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
