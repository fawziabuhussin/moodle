export const TOKEN_COOKIE = "entilaka_token";
export const LOCALE_COOKIE = "entilaka_locale";
export const LOCALES = ["he", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "he";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "he" || value === "ar" || value === "en";
}

export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}

export function localeTag(locale: Locale) {
  if (locale === "he") return "he-IL";
  if (locale === "ar") return "ar";
  return "en-US";
}
