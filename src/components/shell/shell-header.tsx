"use client";

import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { usePageTitle } from "@/components/shell/page-title";
import type { ShellLink } from "@/components/shell/nav-links";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { logoutAction, setLocaleAction } from "@/server/actions/auth";

function sectionTitle(pathname: string, links: ShellLink[]) {
  const match = [...links]
    .filter((link) => pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? links.find((link) => link.href === "/dashboard")?.label ?? "";
}

export function ShellHeader({
  locale,
  links,
  unread,
  notificationsLabel,
  logoutLabel,
  user,
}: {
  locale: Locale;
  links: ShellLink[];
  unread: number;
  notificationsLabel: string;
  logoutLabel: string;
  user: { firstName: string; lastName: string; roleNames: string[] };
}) {
  const pathname = usePathname();
  const registered = usePageTitle();
  const title = registered || sectionTitle(pathname, links);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-navy px-3 text-white shadow-md md:px-8">
      <Link href="/dashboard" className="min-w-0 max-w-[46%] shrink md:hidden">
        <BrandMark size="sm" tone="light" />
      </Link>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight md:text-base">{title}</p>
      <div className="ms-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <div className="flex rounded-xl bg-white/10 p-0.5">
          {(["he", "ar", "en"] as const).map((code) => (
            <form key={code} action={setLocaleAction}>
              <input type="hidden" name="locale" value={code} />
              <button className={`rounded-lg px-1.5 py-1 text-[11px] font-medium md:px-2 md:text-xs ${locale === code ? "bg-primary text-white" : "text-slate-300"}`}>
                {code.toUpperCase()}
              </button>
            </form>
          ))}
        </div>
        <Link href="/notifications" className="relative grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label={notificationsLabel}>
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white tabular-nums">
              <bdi dir="ltr">{unread > 9 ? "9+" : unread}</bdi>
            </span>
          ) : null}
        </Link>
        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <Avatar>
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{`${user.firstName} ${user.lastName}`.trim()}</p>
            <p className="truncate text-xs text-slate-300">{user.roleNames.join(" · ")}</p>
          </div>
        </div>
        <form action={logoutAction} className="shrink-0">
          <button className="grid size-10 place-items-center rounded-xl text-slate-200 hover:bg-white/10 md:flex md:h-10 md:w-auto md:items-center md:gap-1.5 md:px-3" aria-label={logoutLabel}>
            <LogOut className="size-4 md:hidden" />
            <span className="hidden md:inline">{logoutLabel}</span>
          </button>
        </form>
      </div>
    </header>
  );
}
