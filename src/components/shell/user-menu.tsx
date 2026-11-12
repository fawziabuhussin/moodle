"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown, LayoutDashboard, LogOut, MonitorSmartphone, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/constants";
import { logoutAction, logoutEverywhereAction } from "@/server/actions/auth";

export type UserMenuLabels = {
  account: string;
  dashboard: string;
  myBoard: string;
  notifications: string;
  logout: string;
  logoutEverywhere: string;
};

const itemClass =
  "flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-slate-700 outline-none transition-colors data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950";

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
}

/** The account button at the end of the top bar, as in Moodle: the user's avatar opens their menu. */
export function UserMenu({
  locale,
  user,
  portal,
  unread,
  labels,
}: {
  locale: Locale;
  user: { name: string; email: string; initials: string; roleLine: string };
  portal: boolean;
  unread: number;
  labels: UserMenuLabels;
}) {
  const dir = locale === "en" ? "ltr" : "rtl";
  return (
    <Menu.Root dir={dir} modal={false}>
      <Menu.Trigger
        className="group flex shrink-0 items-center gap-1.5 rounded-full p-0.5 pe-1.5 text-slate-200 ring-1 ring-white/10 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 data-[state=open]:bg-white/10"
        aria-label={labels.account}
        title={user.name}
      >
        <Avatar className="size-9 ring-2 ring-white/25">
          <AvatarFallback className="text-[11px]">{user.initials}</AvatarFallback>
        </Avatar>
        <ChevronDown aria-hidden className="hidden size-3.5 transition-transform group-data-[state=open]:rotate-180 sm:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="entilaka-rise z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 text-slate-900 shadow-[0_24px_60px_-20px_rgb(11_16_32/0.45)]"
        >
          <div className="relative mb-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-[#0b1020] via-[#13203d] to-[#0e3a5c] p-3.5 text-white">
            <div aria-hidden className="absolute -end-6 -top-8 size-24 rounded-full bg-sky-500/25 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <Avatar className="size-12 ring-2 ring-white/30">
                <AvatarFallback className="text-sm">{user.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-bold">{user.name}</p>
                <p className="truncate text-xs text-slate-300" dir="ltr">
                  {user.email}
                </p>
                {user.roleLine ? <p className="mt-1 truncate text-[11px] font-semibold text-orange-300">{user.roleLine}</p> : null}
              </div>
            </div>
          </div>

          {portal ? (
            <Menu.Item asChild>
              <Link href="/student-board" className={itemClass}>
                <Row icon={<UserRound className="size-4" />}>{labels.myBoard}</Row>
              </Link>
            </Menu.Item>
          ) : (
            <Menu.Item asChild>
              <Link href="/dashboard" className={itemClass}>
                <Row icon={<LayoutDashboard className="size-4" />}>{labels.dashboard}</Row>
              </Link>
            </Menu.Item>
          )}
          <Menu.Item asChild>
            <Link href="/notifications" className={itemClass}>
              <Row icon={<Bell className="size-4" />}>{labels.notifications}</Row>
              {unread > 0 ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  <bdi dir="ltr">{unread > 99 ? "99+" : unread}</bdi>
                </span>
              ) : null}
            </Link>
          </Menu.Item>

          <Menu.Separator className="my-1.5 h-px bg-slate-100" />

          <form action={logoutEverywhereAction}>
            <Menu.Item asChild>
              <button type="submit" className={itemClass}>
                <Row icon={<MonitorSmartphone className="size-4" />}>{labels.logoutEverywhere}</Row>
              </button>
            </Menu.Item>
          </form>
          <form action={logoutAction}>
            <Menu.Item asChild>
              <button type="submit" className={`${itemClass} text-rose-600 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-700`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500">
                  <LogOut className="size-4 rtl:-scale-x-100" />
                </span>
                <span className="min-w-0 flex-1 truncate">{labels.logout}</span>
              </button>
            </Menu.Item>
          </form>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
