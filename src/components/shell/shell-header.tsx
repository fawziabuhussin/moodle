"use client";

import { Bell, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { usePageTitle } from "@/components/shell/page-title";
import type { ShellLink } from "@/components/shell/nav-links";
import { UserMenu, type UserMenuLabels } from "@/components/shell/user-menu";
import type { Locale } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { setLocaleAction } from "@/server/actions/auth";

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
  user,
  portal,
  menuLabels,
}: {
  locale: Locale;
  links: ShellLink[];
  unread: number;
  notificationsLabel: string;
  user: { name: string; email: string; initials: string; roleLine: string };
  portal: boolean;
  menuLabels: UserMenuLabels;
}) {
  const pathname = usePathname();
  const registered = usePageTitle();
  const title = registered || sectionTitle(pathname, links);
  const section = sectionTitle(pathname, links);

  return (
    <header className="glass-dark brand-hairline sticky top-0 z-30 flex h-16 items-center gap-2 px-3 text-white shadow-[0_8px_30px_-12px_rgb(11_16_32/0.6)] md:px-8">
      <Link href="/dashboard" className="shrink-0 md:hidden" aria-label="انطلاقة אנטילאקה">
        <BrandMark size="sm" tone="light" className="[&>span:last-child]:hidden" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-tight md:hidden">{title}</p>
        <p className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <span className="truncate font-semibold text-slate-300">{section}</span>
          {title && title !== section ? (
            <>
              <ChevronLeft aria-hidden className="size-3.5 shrink-0 text-slate-500 ltr:rotate-180" />
              <span className="truncate font-semibold text-white">{title}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <div className="flex rounded-xl bg-white/[0.08] p-0.5 ring-1 ring-white/10">
          {(["he", "ar", "en"] as const).map((code) => (
            <form key={code} action={setLocaleAction}>
              <input type="hidden" name="locale" value={code} />
              <button
                className={cn(
                  "rounded-lg px-1.5 py-1 text-[11px] font-semibold transition-colors md:px-2 md:text-xs",
                  locale === code ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_2px_10px_-2px_rgb(26_143_216/0.8)]" : "text-slate-400 hover:text-white",
                )}
              >
                {code.toUpperCase()}
              </button>
            </form>
          ))}
        </div>
        <Link
          href="/notifications"
          className="relative grid size-10 place-items-center rounded-xl text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={notificationsLabel}
        >
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="entilaka-pulse absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-1 text-[10px] font-bold text-white tabular-nums ring-2 ring-[#0b1020]">
              <bdi dir="ltr">{unread > 9 ? "9+" : unread}</bdi>
            </span>
          ) : null}
        </Link>
        <UserMenu locale={locale} user={user} portal={portal} unread={unread} labels={menuLabels} />
      </div>
    </header>
  );
}
