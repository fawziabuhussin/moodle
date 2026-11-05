import { BrandLogo } from "@/components/brand";
import { getLocale } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

export default async function LoginLoading() {
  const dict = getDictionary((await getLocale()) as Locale);
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0F172A] px-6 text-white" style={{ backgroundImage: "radial-gradient(circle at 100% 0%, rgba(14,165,233,0.35), transparent 36%), linear-gradient(165deg, #0F172A 0%, #0B1F3A 55%, #0C4A6E 100%)" }}>
      <div className="grid justify-items-center gap-5">
        <p className="sr-only">{dict.common.loading}</p>
        <BrandLogo className="size-24 shadow-lg" />
        <div className="h-1 w-28 overflow-hidden rounded-full bg-white/15">
          <div className="entilaka-shimmer h-full w-full rounded-full bg-sky-400" />
        </div>
      </div>
    </main>
  );
}
