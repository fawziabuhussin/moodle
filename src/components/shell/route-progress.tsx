"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "run" | "done";

function samePage(url: URL) {
  return url.pathname === window.location.pathname && url.search === window.location.search;
}

function isAppLink(anchor: HTMLAnchorElement) {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return !samePage(url);
}

export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const route = `${pathname}?${search.toString()}`;
  const [phase, setPhase] = useState<Phase>("idle");
  const [width, setWidth] = useState(0);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !isAppLink(anchor)) return;
      setPhase("run");
    }
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setPhase((current) => (current === "run" ? "done" : "idle"));
  }, [route]);

  useEffect(() => {
    if (phase !== "run") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setWidth(72);
      return;
    }
    let value = 12;
    setWidth(12);
    let frame = 0;
    const tick = () => {
      value = Math.min(88, value + Math.max(0.35, (88 - value) * 0.075));
      setWidth(value);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    const timeout = window.setTimeout(() => setPhase("done"), 12000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    setWidth(100);
    const timeout = window.setTimeout(() => {
      setPhase("idle");
      setWidth(0);
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1" aria-hidden>
      <div className="absolute inset-y-0 start-0" style={{ width: `${width}%` }}>
        <div className="h-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]" />
        <div className="absolute inset-y-0 end-0 w-10 bg-gradient-to-l from-orange-300 to-transparent" />
      </div>
    </div>
  );
}
