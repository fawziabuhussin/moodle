import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy · Entilaka",
  description: "How the Entilaka portal uses account, attendance, course, and stipend information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10 text-slate-800">
      <p className="text-sm font-semibold text-primary">Entilaka · انطلاقة · אנטילאקה</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-slate-500">Jatt al-Muthallath youth center. This page covers the website and the iOS app.</p>

      <section className="mt-8 space-y-3 text-sm leading-6">
        <h2 className="text-lg font-semibold">What the portal stores</h2>
        <p>The center creates accounts for students and staff. A profile can include a name, email, phone number, national ID, role, and the courses a person belongs to.</p>
        <p>The portal also stores attendance, grades, course questions, announcements, uploaded files, and stipend records. Bank details are stored only when a student or the center enters them for a stipend.</p>
        <p>Signing in keeps a session cookie on the device so the person stays signed in. The iOS app opens this same website. It does not add a separate account system.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6">
        <h2 className="text-lg font-semibold">How it is used</h2>
        <p>The information is used to run the center: attendance, courses, files, and stipends. It is not sold and it is not used for advertising.</p>
        <p>Managers can see the accounts they administer. Students see their own profile, courses, grades, files, and stipend records.</p>
        <p>A person can ask a center manager, inside the portal, to correct or remove details the center holds.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6" dir="rtl">
        <h2 className="text-lg font-semibold">سياسة الخصوصية</h2>
        <p>المركز ينشئ حسابات الطلاب والطاقم. قد يتضمن الحساب الاسم والبريد والهاتف ورقم الهوية والدور والمساقات. يحفظ النظام الحضور والعلامات والأسئلة والملفات وبيانات المنحة، بما فيها تفاصيل البنك عندما تُدخل للمنحة.</p>
        <p>تُستخدم هذه المعلومات لإدارة المركز فقط، ولا تُباع ولا تُستخدم للإعلان. يمكن طلب التصحيح أو الحذف من مدير المركز داخل البوابة. تطبيق آيفون يفتح نفس الموقع.</p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6" dir="rtl">
        <h2 className="text-lg font-semibold">מדיניות פרטיות</h2>
        <p>המרכז פותח חשבונות לתלמידים ולצוות. פרופיל יכול לכלול שם, דוא״ל, טלפון, תעודת זהות, תפקיד ומסלולים. המערכת שומרת נוכחות, ציונים, שאלות, קבצים ונתוני מלגה, כולל פרטי בנק כשהם מוזנים לצורך מלגה.</p>
        <p>המידע משמש להפעלת המרכז. הוא לא נמכר ולא משמש לפרסום. אפשר לבקש מנהל במרכז לתקן או למחוק פרטים. אפליקציית ה-iOS פותחת את אותו אתר.</p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/login" className="text-primary">Back to sign in</Link>
      </p>
    </main>
  );
}
