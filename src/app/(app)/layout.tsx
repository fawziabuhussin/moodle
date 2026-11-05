import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { NAV_ITEMS, STUDENT_NAV } from "@/components/shell/nav";
import { isStudentPortal } from "@/lib/access";
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
  const portal = isStudentPortal(session);
  const links = (portal ? STUDENT_NAV : NAV_ITEMS.filter((item) => {
    if (item.permission && !hasPermission(session.permissions, item.permission)) return false;
    if (item.studentOr && !hasPermission(session.permissions, item.studentOr)) return false;
    return true;
  })).map((item) => ({
    href: item.href,
    label: dict.nav[item.key],
    icon: item.icon,
    section: portal ? "academic" as const : item.section,
  }));

  return (
    <AppShell
      locale={locale}
      dict={dict}
      flat={portal}
      links={links}
      unread={unread}
      user={{ firstName: session.firstName, lastName: session.lastName, email: session.email, roleNames: session.roleNames }}
    >
      {children}
    </AppShell>
  );
}
