import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { PageTitleProvider } from "@/components/shell/page-title";
import { ShellHeader } from "@/components/shell/shell-header";
import { BottomNav, SideNav, type ShellLink } from "@/components/shell/nav-links";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/lib/i18n";
import { fullName } from "@/lib/utils";

export function AppShell({
  locale,
  dict,
  links,
  unread,
  user,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  links: ShellLink[];
  unread: number;
  user: { firstName: string; lastName: string; email: string; roleNames: string[] };
  children: ReactNode;
}) {
  return (
    <PageTitleProvider>
      <div className="min-h-dvh overflow-x-clip">
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-72 flex-col bg-navy px-3 py-5 text-white shadow-md md:flex">
          <Link href="/dashboard" className="mb-5 px-2">
            <BrandMark tone="light" />
          </Link>
          <SideNav
            links={links}
            sections={{ academic: dict.nav.academic, admin: dict.nav.administration, system: dict.nav.system }}
          />
        </aside>
        <div className="min-w-0 md:ps-72">
          <ShellHeader
            locale={locale}
            links={links}
            unread={unread}
            notificationsLabel={dict.nav.notifications}
            logoutLabel={dict.nav.logout}
            user={{ firstName: user.firstName, lastName: user.lastName, roleNames: user.roleNames }}
          />
          <main className="min-w-0 px-4 pt-4 pb-[max(6rem,calc(6rem+env(safe-area-inset-bottom)))] md:px-8 md:pt-5 md:pb-10">{children}</main>
        </div>
        <BottomNav
          links={links}
          moreLabel={dict.nav.more}
          closeLabel={dict.attendance.close}
          logoutLabel={dict.nav.logout}
          userName={fullName(user)}
          roleLine={user.roleNames.join(" · ")}
        />
      </div>
    </PageTitleProvider>
  );
}
