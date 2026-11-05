import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { NAV_ITEMS } from "@/components/shell/nav";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const unread = await getPrisma().userNotification.count({
    where: { userId: session.id, readAt: null },
  });
  const links = NAV_ITEMS.filter((item) => {
    if (item.permission && !hasPermission(session.permissions, item.permission)) return false;
    if (item.studentOr) {
      const allowed = session.roleSlugs.includes("student") || hasPermission(session.permissions, item.studentOr);
      if (!allowed) return false;
    }
    return true;
  }).map((item) => ({
    href:
      item.key === "students" &&
      session.roleSlugs.includes("student") &&
      !hasPermission(session.permissions, "manage_users_and_roles") &&
      !hasPermission(session.permissions, "manage_attendance")
        ? `/students/${session.id}`
        : item.href,
    label: dict.nav[item.key],
    icon: item.icon,
    section: item.section,
  }));

  return (
    <AppShell
      locale={locale}
      dict={dict}
      links={links}
      unread={unread}
      user={{ firstName: session.firstName, lastName: session.lastName, email: session.email, roleNames: session.roleNames }}
    >
      {children}
    </AppShell>
  );
}
