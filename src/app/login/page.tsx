import Link from "next/link";
import { BrandLogo, BrandMark } from "@/components/brand";
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
    <main dir="ltr" className="flex min-h-dvh flex-col bg-white lg:grid lg:grid-cols-2">
      <section dir={dir} className="order-2 flex flex-1 flex-col justify-center px-5 py-6 sm:px-8 lg:order-1 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
            <BrandMark className="hidden lg:flex" />
            <div className="ms-auto flex rounded-full bg-slate-100 p-1">
              {(["he", "ar", "en"] as const).map((code) => (
                <form key={code} action={setLocaleAction}>
                  <input type="hidden" name="locale" value={code} />
                  <button className={`min-h-9 min-w-9 rounded-full px-2 text-xs font-semibold ${locale === code ? "bg-primary text-white shadow-sm" : "text-slate-500"}`}>
                    {code.toUpperCase()}
                  </button>
                </form>
              ))}
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
            <span className="font-arabic">تسجيل الدخول</span>
            <span className="px-1.5 font-normal text-slate-300">/</span>
            <span>כניסה למערכת</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">{dict.login.subtitle}</p>
          <div className="mt-6">
            <LoginForm
              next={next}
              emailLabel={dict.login.email}
              passwordLabel={dict.login.password}
              submitLabel={dict.login.submit}
              pendingLabel={dict.login.submitting}
              quickLabel={dict.login.quick}
            />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/privacy" className="underline-offset-2 hover:underline">{dict.login.privacy}</Link>
          </p>
        </div>
      </section>

      <section className="order-1 bg-[#0F172A] px-4 py-4 text-white lg:order-2 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-12 lg:py-12" style={{ backgroundImage: "radial-gradient(circle at 100% 0%, rgba(14,165,233,0.35), transparent 36%), linear-gradient(165deg, #0F172A 0%, #0B1F3A 55%, #0C4A6E 100%)" }}>
        <div className="flex items-center gap-3">
          <BrandLogo className="size-16 shrink-0 shadow-md lg:size-40" />
          <div className="min-w-0" dir="rtl">
            <p className="text-lg font-semibold lg:text-2xl">
              <span className="font-arabic">انطلاقة</span> אנטילאקה
            </p>
            <p className="text-sm font-medium text-orange-400">جت المثلث - مركز شبابي</p>
          </div>
        </div>
        <p className="mt-3 font-arabic text-sm leading-6 text-slate-100 lg:mt-0 lg:text-2xl lg:leading-snug" dir="rtl">مركز شبابي مجتمعي غير ربحي - جت المثلث</p>
      </section>
    </main>
  );
}
