"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { attachSessionCookie, authenticate, clearSession, getLocale, getSession } from "@/lib/auth";
import { LOCALE_COOKIE, isLocale } from "@/lib/constants";
import { field, isEmail } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";
import { safeNextPath } from "@/lib/utils";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email) || password.length < 8) return { error: dict.login.invalid };

  let result: Awaited<ReturnType<typeof authenticate>> = null;
  try {
    result = await authenticate(email, password, null);
  } catch {
    return { error: dict.errors.database };
  }
  if (!result) return { error: dict.login.invalid };

  await attachSessionCookie(result.token);
  const jar = await cookies();
  if (!isLocale(jar.get(LOCALE_COOKIE)?.value) && isLocale(result.user.locale)) {
    jar.set(LOCALE_COOKIE, result.user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  redirect(safeNextPath(field(formData, "next")));
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function setLocaleAction(formData: FormData) {
  const locale = field(formData, "locale");
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession().catch(() => null);
  if (session) {
    await getPrisma().user.update({ where: { id: session.id }, data: { locale } }).catch(() => undefined);
  }
  const referer = (await headers()).get("referer");
  let next = "/dashboard";
  if (referer) {
    try {
      const url = new URL(referer);
      next = `${url.pathname}${url.search}`;
    } catch {
      next = "/dashboard";
    }
  }
  if (!session && next.startsWith("/login")) redirect("/login");
  redirect(safeNextPath(next));
}
