import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { BrandArcs, BrandMark } from "@/components/brand";
import { PageTitleProvider } from "@/components/shell/page-title";
import { ShellHeader } from "@/components/shell/shell-header";
import { BottomNav, SideNav, type ShellLink } from "@/components/shell/nav-links";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/lib/i18n";
import { fullName, initials } from "@/lib/utils";

export function AppShell({
  locale,
  dict,
  links,
  flat = false,
  unread,
  user,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  links: ShellLink[];
  flat?: boolean;
  unread: number;
  user: { firstName: string; lastName: string; email: string; roleNames: string[] };
  children: ReactNode;
}) {
  return (
    <PageTitleProvider>
      <div className="min-h-dvh overflow-x-clip">
        <aside className="bg-ink fixed inset-y-0 start-0 z-30 hidden w-72 flex-col overflow-hidden text-white shadow-2xl md:flex">
          <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_45%)]" />
          <BrandArcs muted className="absolute -bottom-24 -end-20 w-72 opacity-20" />
          <div className="relative flex min-h-0 flex-1 flex-col px-3 pt-5 pb-3">
            <Link href="/dashboard" className="mb-6 rounded-2xl px-2 py-1 transition-opacity hover:opacity-90">
              <BrandMark tone="light" />
            </Link>
            <SideNav
              links={links}
              sections={flat ? { academic: "", admin: "", system: "" } : { academic: dict.nav.academic, admin: dict.nav.administration, system: dict.nav.system }}
            />
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 backdrop-blur">
              <Avatar className="size-10 ring-white/20">
                <AvatarFallback>{initials(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold">{fullName(user)}</p>
                <p className="truncate text-[11px] text-slate-400">{user.roleNames.join(" · ")}</p>
              </div>
              <form action={logoutAction}>
                <button
                  className="grid size-9 place-items-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={dict.nav.logout}
                  title={dict.nav.logout}
                >
                  <LogOut className="size-4 rtl:-scale-x-100" />
                </button>
              </form>
            </div>
          </div>
        </aside>
        <div className="min-w-0 md:ps-72">
          <ShellHeader
            locale={locale}
            links={links}
            unread={unread}
            notificationsLabel={dict.nav.notifications}
            portal={flat}
            user={{ name: fullName(user), email: user.email, initials: initials(user), roleLine: user.roleNames.join(" · ") }}
            menuLabels={{
              account: dict.nav.account,
              dashboard: dict.nav.dashboard,
              myBoard: dict.nav.myBoard,
              notifications: dict.nav.notifications,
              logout: dict.nav.logout,
              logoutEverywhere: dict.nav.logoutEverywhere,
            }}
          />
          <main className="entilaka-rise mx-auto min-w-0 max-w-[1600px] px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-12">{children}</main>
        </div>
        <BottomNav
          flat={flat}
          links={links}
          moreLabel={dict.nav.more}
          closeLabel={dict.attendance.close}
          logoutLabel={dict.nav.logout}
          userName={fullName(user)}
          roleLine={user.roleNames.join(" · ")}
          initials={initials(user)}
        />
      </div>
    </PageTitleProvider>
  );
}
