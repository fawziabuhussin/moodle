"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCheck,
  Ellipsis,
  Folder,
  GraduationCap,
  UtensilsCrossed,
  House,
  IdCard,
  LogOut,
  KeyRound,
  MessagesSquare,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { BrandArcs } from "@/components/brand";
import type { IconName, NavSection } from "@/components/shell/nav";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

const icons = {
  home: House,
  check: CheckCheck,
  students: GraduationCap,
  wallet: Wallet,
  sessions: MessagesSquare,
  courses: BookOpen,
  bell: Bell,
  users: Users,
  roles: KeyRound,
  settings: Settings,
  terminal: IdCard,
  files: Folder,
  food: UtensilsCrossed,
} satisfies Record<IconName, typeof House>;

export type ShellLink = { href: string; label: string; icon: IconName; section: NavSection };

const SECTIONS: NavSection[] = ["academic", "admin", "system"];

function active(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ links, sections }: { links: ShellLink[]; sections: Record<NavSection, string> }) {
  const pathname = usePathname();
  let previous = "";
  return (
    <nav className="-mx-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-1 [scrollbar-width:none]">
      {links.map((link) => {
        const Icon = icons[link.icon];
        const on = active(pathname, link.href);
        const heading = link.section !== previous && Boolean(sections[link.section]);
        const divided = heading && previous !== "";
        previous = link.section;
        return (
          <div key={link.href} className={cn(divided && "mt-4")}>
            {heading ? <p className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">{sections[link.section]}</p> : null}
            <Link
              href={link.href}
              title={link.label}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
                on
                  ? "bg-gradient-to-l from-transparent via-sky-500/10 to-sky-500/25 font-semibold text-white ring-1 ring-white/10 rtl:bg-gradient-to-r"
                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {on ? <span aria-hidden className="bg-brand-gradient absolute inset-y-2 start-0 w-1 rounded-full" /> : null}
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                  on ? "bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[0_4px_14px_-4px_rgb(26_143_216/0.9)]" : "bg-white/[0.04] text-slate-400 group-hover:text-sky-300",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="truncate">{link.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

const PRIMARY_HREFS = ["/dashboard", "/attendance", "/students", "/courses"];

export function BottomNav({
  links,
  flat = false,
  moreLabel,
  closeLabel,
  logoutLabel,
  userName,
  roleLine,
  initials,
}: {
  links: ShellLink[];
  flat?: boolean;
  moreLabel: string;
  closeLabel: string;
  logoutLabel: string;
  userName: string;
  roleLine: string;
  initials: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = flat
    ? links
    : PRIMARY_HREFS.flatMap((href) => {
        const link = links.find((item) => item.href === href || item.href.startsWith(`${href}/`));
        return link ? [link] : [];
      });
  const primaryHrefs = new Set(primary.map((link) => link.href));
  const extra = links.filter((link) => !primaryHrefs.has(link.href));
  const moreOn = open || extra.some((link) => active(pathname, link.href));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label={closeLabel} onClick={() => setOpen(false)} />
          <div className="entilaka-drawer absolute inset-y-0 start-0 flex w-[min(88vw,20rem)] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="bg-ink relative flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-5 text-white">
              <BrandArcs muted className="absolute -end-10 -bottom-16 w-48 opacity-50" />
              <div className="relative flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-sky-600 to-lime-500 text-sm font-bold ring-2 ring-white/20">{initials}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{userName}</p>
                  <p className="truncate text-xs text-slate-400">{roleLine}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="relative grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 ring-1 ring-white/10 hover:bg-white/10" aria-label={closeLabel}>
                <X className="size-4" />
              </button>
            </div>
            <nav className="grid flex-1 content-start gap-1 overflow-y-auto p-3">
              {SECTIONS.map((section) => {
                const items = extra.filter((link) => link.section === section);
                if (items.length === 0) return null;
                return (
                  <div key={section} className="grid gap-1">
                    {items.map((link) => {
                      const Icon = icons[link.icon];
                      const on = active(pathname, link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-2xl px-2.5 text-sm transition-colors",
                            on ? "bg-sky-50 font-semibold text-sky-800 ring-1 ring-sky-100" : "text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          <span className={cn("grid size-9 place-items-center rounded-xl", on ? "bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(26_143_216/0.8)]" : "bg-slate-100 text-slate-500")}>
                            <Icon className="size-4" />
                          </span>
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            <form action={logoutAction} className="border-t border-slate-200/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50"><LogOut className="size-4 rtl:-scale-x-100" />{logoutLabel}</button>
            </form>
          </div>
        </div>
      ) : null}
      <nav
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid rounded-[1.75rem] border border-white/70 p-1.5 shadow-[0_18px_40px_-14px_rgb(11_16_32/0.35)] ring-1 ring-slate-900/5 md:hidden"
        style={{ gridTemplateColumns: `repeat(${primary.length + (extra.length ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {primary.map((link) => {
          const Icon = icons[link.icon];
          const on = active(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={on ? "page" : undefined}
              className={cn("group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[10px] font-semibold transition-colors", on ? "text-sky-700" : "text-slate-500")}
            >
              <span
                className={cn(
                  "grid h-8 w-12 place-items-center rounded-full transition-all duration-300 ease-[var(--ease-spring)]",
                  on ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_6px_14px_-4px_rgb(13_114_184/0.7)]" : "group-active:scale-90",
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="line-clamp-2 max-w-full text-center text-[9.5px] leading-[1.15]">{link.label}</span>
            </Link>
          );
        })}
        {extra.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn("group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold", moreOn ? "text-sky-700" : "text-slate-500")}
            aria-expanded={open}
          >
            <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-all", moreOn ? "bg-sky-100 text-sky-700" : "group-active:scale-90")}>
              <Ellipsis className="size-[18px]" />
            </span>
            <span className="max-w-full truncate">{moreLabel}</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
