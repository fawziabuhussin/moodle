import Link from "next/link";
import { BookOpen, CheckCheck, Sparkles } from "lucide-react";
import { BrandArcs, BrandLogo, BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getLocale } from "@/lib/auth";
import { direction, type Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { setLocaleAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const next = (await searchParams).next ?? "";
  const dir = direction(locale);

  return (
    <main dir="ltr" className="flex min-h-dvh flex-col bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section dir={dir} className="relative order-2 flex flex-1 flex-col justify-center overflow-hidden px-5 py-8 sm:px-8 lg:order-1 lg:px-14 xl:px-24">
        <div aria-hidden className="bg-dots-dark absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />
        <div className="entilaka-rise mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between gap-3">
            <BrandMark className="hidden lg:flex" />
            <div className="ms-auto flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/70">
              {(["he", "ar", "en"] as const).map((code) => (
                <form key={code} action={setLocaleAction}>
                  <input type="hidden" name="locale" value={code} />
                  <button className={`min-h-9 min-w-9 rounded-full px-2.5 text-xs font-bold transition-colors ${locale === code ? "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-4px_rgb(13_114_184/0.7)]" : "text-slate-500 hover:text-slate-800"}`}>
                    {code.toUpperCase()}
                  </button>
                </form>
              ))}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
            <span className="size-1.5 rounded-full bg-lime-500" />
            {dict.tagline}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
            <span className="font-arabic">تسجيل الدخول</span>
            <span className="px-2 font-light text-slate-300">/</span>
            <span>כניסה למערכת</span>
          </h1>
          <span aria-hidden className="bg-brand-gradient mt-3 block h-1 w-16 rounded-full" />
          <p className="mt-4 text-sm text-slate-500">{dict.login.subtitle}</p>
          <div className="mt-7 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur sm:p-6">
            <LoginForm
              next={next}
              emailLabel={dict.login.email}
              passwordLabel={dict.login.password}
              submitLabel={dict.login.submit}
              pendingLabel={dict.login.submitting}
            />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/privacy" className="underline-offset-2 hover:text-slate-800 hover:underline">{dict.login.privacy}</Link>
          </p>
        </div>
      </section>

      <section className="bg-ink relative isolate order-1 overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 text-white lg:order-2 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div aria-hidden className="absolute -top-32 -end-24 -z-10 size-[28rem] rounded-full bg-sky-500/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -start-24 -z-10 size-[26rem] rounded-full bg-orange-500/20 blur-3xl" />
        <div aria-hidden className="absolute top-1/2 start-1/3 -z-10 size-72 rounded-full bg-lime-400/10 blur-3xl" />

        <div className="flex items-center gap-4" dir="rtl">
          <BrandLogo className="size-16 shrink-0 shadow-xl ring-4 ring-white/10 lg:size-24" />
          <div className="min-w-0">
            <p className="text-xl font-extrabold lg:text-3xl">
              <span className="font-arabic">انطلاقة</span> אנטילאקה
            </p>
            <p className="text-sm font-semibold text-orange-400 lg:text-base">جت المثلث - مركز شبابي</p>
          </div>
        </div>

        <div className="relative hidden flex-1 items-center justify-center lg:flex">
          <BrandArcs animated className="w-[min(30rem,80%)] drop-shadow-[0_20px_40px_rgb(26_143_216/0.25)]" />
          <div className="entilaka-float glass-dark absolute top-[18%] start-[6%] flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-lime-400 to-lime-600 text-white"><CheckCheck className="size-5" /></span>
            <span className="text-sm font-bold">{dict.nav.attendance}</span>
          </div>
          <div className="entilaka-float glass-dark absolute end-[4%] bottom-[16%] flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl [animation-delay:1.5s]">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white"><BookOpen className="size-5" /></span>
            <span className="text-sm font-bold">{dict.nav.courses}</span>
          </div>
          <div className="entilaka-float glass-dark absolute end-[10%] top-[8%] flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl [animation-delay:3s]">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white"><Sparkles className="size-5" /></span>
            <span className="block text-sm font-bold font-arabic" dir="rtl">انطلق نحو المستقبل</span>
          </div>
        </div>

        <p className="mt-4 max-w-lg font-arabic text-sm leading-6 text-slate-300 lg:mt-0 lg:text-2xl lg:leading-snug lg:text-white" dir="rtl">
          مركز شبابي مجتمعي غير ربحي - جت المثلث
        </p>
      </section>
    </main>
  );
}
