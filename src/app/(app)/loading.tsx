import { getLocale } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

export default async function Loading() {
  const dict = getDictionary((await getLocale()) as Locale);
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4">
      <p className="sr-only">{dict.common.loading}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <div className="entilaka-shimmer h-3 w-36 rounded-full bg-slate-200" />
          <div className="entilaka-shimmer h-3 w-64 max-w-full rounded-full bg-slate-100" />
        </div>
        <div className="entilaka-shimmer h-9 w-28 rounded-xl bg-slate-200" />
      </div>
      <div className="flex gap-2">
        <div className="entilaka-shimmer h-8 w-16 rounded-full bg-slate-200" />
        <div className="entilaka-shimmer h-8 w-20 rounded-full bg-slate-100" />
        <div className="entilaka-shimmer hidden h-8 w-24 rounded-full bg-slate-100 sm:block" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
            <div className="entilaka-shimmer size-9 shrink-0 rounded-full bg-slate-100" style={{ animationDelay: `${index * 90}ms` }} />
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="entilaka-shimmer h-3 rounded-full bg-slate-200" style={{ width: `${46 - index * 3}%`, animationDelay: `${index * 90}ms` }} />
              <div className="entilaka-shimmer h-2.5 w-1/2 rounded-full bg-slate-100" style={{ animationDelay: `${index * 90}ms` }} />
            </div>
            <div className="entilaka-shimmer h-6 w-16 shrink-0 rounded-full bg-slate-100" style={{ animationDelay: `${index * 90}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
