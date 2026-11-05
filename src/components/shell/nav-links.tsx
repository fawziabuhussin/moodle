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
  KeyRound,
  MessagesSquare,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
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
    <nav className="grid gap-0.5 overflow-y-auto">
      {links.map((link) => {
        const Icon = icons[link.icon];
        const on = active(pathname, link.href);
        const heading = link.section !== previous && Boolean(sections[link.section]);
        const divided = heading && previous !== "";
        previous = link.section;
        return (
          <div key={link.href} className={cn(divided && "mt-3 border-t border-white/10 pt-3")}>
            {heading ? <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{sections[link.section]}</p> : null}
            <Link
              href={link.href}
              title={link.label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                on ? "bg-white/10 font-medium text-white shadow-sm ring-1 ring-sky-400/40" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("size-4 shrink-0", on ? "text-sky-400" : "text-slate-500")} />
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
}: {
  links: ShellLink[];
  flat?: boolean;
  moreLabel: string;
  closeLabel: string;
  logoutLabel: string;
  userName: string;
  roleLine: string;
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
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label={closeLabel} onClick={() => setOpen(false)} />
          <div className="entilaka-drawer absolute inset-y-0 start-0 flex w-[min(88vw,20rem)] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLine}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-xl hover:bg-slate-100" aria-label={closeLabel}>
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
                            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm",
                            on ? "bg-primary font-medium text-primary-foreground" : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <Icon className="size-4" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            <form action={logoutAction} className="border-t border-slate-200/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50">{logoutLabel}</button>
            </form>
          </div>
        </div>
      ) : null}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white px-1 pt-1 shadow-md md:hidden"
        style={{
          gridTemplateColumns: `repeat(${primary.length + (extra.length ? 1 : 0)}, minmax(0, 1fr))`,
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
        }}
      >
        {primary.map((link) => {
          const Icon = icons[link.icon];
          const on = active(pathname, link.href);
          return (
            <Link key={link.href} href={link.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-medium", on ? "text-primary" : "text-slate-500")}>
              <Icon className="size-5" />
              <span className="line-clamp-2 max-w-full text-center leading-tight">{link.label}</span>
            </Link>
          );
        })}
        {extra.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium", moreOn ? "text-primary" : "text-slate-500")}
            aria-expanded={open}
          >
            <Ellipsis className="size-5" />
            <span className="max-w-full truncate">{moreLabel}</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
