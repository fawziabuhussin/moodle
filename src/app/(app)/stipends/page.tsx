import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StipendSheet } from "@/components/stipends/sheet";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import type { Locale } from "@/lib/constants";
import { asNumber, formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { currentPeriod } from "@/lib/time";
import { fullName } from "@/lib/utils";

export default async function StipendsPage({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const manager = hasPermission(session.permissions, "manage_stipends");
  const isStudent = session.roleSlugs.includes("student");
  if (!manager && !isStudent) redirect("/dashboard?notice=forbidden");
  const query = await searchParams;
  const now = currentPeriod();
  const summary = manager && query.view === "summary";
  const match = query.period && /^\d{4}-\d{2}$/.test(query.period) ? query.period : `${now.year}-${String(now.month).padStart(2, "0")}`;
  const [year, month] = match.split("-").map(Number);
  const db = getPrisma();

  const people = manager
    ? await db.user.findMany({
        where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
        include: {
          studentProfile: true,
          stipendPayments: summary ? { orderBy: [{ year: "desc" }, { month: "desc" }] } : { where: { year, month } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
    : [];
  const own = manager
    ? []
    : await db.stipendPayment.findMany({
        where: { studentId: session.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });

  const labels = {
    search: dict.stipends.search,
    month: dict.stipends.month,
    saving: dict.common.saving,
    approve: dict.stipends.approve,
    paid: dict.stipends.paid,
    bulkApprove: dict.stipends.bulkApprove,
    approvedMany: dict.stipends.approvedMany,
    saved: dict.common.saved,
    status: dict.common.status,
    name: dict.common.name,
    notes: dict.common.notes,
    none: dict.stipends.none,
    noMatches: dict.attendance.noMatches,
    formula: dict.stipends.formula,
    select: dict.stipends.select,
    bulkPay: dict.stipends.bulkPay,
    paidMany: dict.stipends.paidMany,
    summary: dict.stipends.summary,
    monthView: dict.stipends.monthView,
    amount: dict.stipends.amount,
    example: dict.stipends.example,
    apply: dict.stipends.apply,
    monthTotal: dict.stipends.monthTotal,
    totalGiven: dict.stipends.totalGiven,
    totalPaid: dict.stipends.totalPaid,
    waiting: dict.stipends.waiting,
    months: dict.stipends.months,
    base: dict.stipends.base,
    deduction: dict.stipends.deduction,
    bonus: dict.stipends.bonus,
    paidOn: dict.stipends.paidOn,
    statuses: {
      PENDING: dict.status.PENDING,
      APPROVED: dict.status.APPROVED,
      PAID: dict.status.PAID,
      CANCELLED: dict.status.CANCELLED,
    },
    editAccount: dict.users.viewEdit,
    resetPassword: dict.users.resetPassword,
    save: dict.common.save,
    savingAccount: dict.common.saving,
    close: dict.attendance.close,
    email: dict.common.email,
    phone: dict.common.phone,
    bank: dict.students.bankName,
    branch: dict.students.bankBranch,
    accountNumber: dict.students.bankAccount,
    confirmation: dict.students.bankConfirmation,
  };

  return (
    <div>
      <PageHeader title={manager ? dict.stipends.title : dict.stipends.ownTitle} description={manager ? dict.stipends.subtitle : dict.stipends.ownSubtitle} />
      <StipendSheet
        mode={manager ? "manage" : "own"}
        view={summary ? "summary" : "month"}
        period={match}
        locale={locale}
        labels={labels}
        rows={people.map((student) => {
          const payment = summary ? undefined : student.stipendPayments[0];
          return {
            id: payment?.id ?? "",
            studentId: student.id,
            name: fullName(student),
            amount: payment ? asNumber(payment.finalAmount) : null,
            notes: payment?.notes ?? "",
            status: payment?.status ?? "PENDING",
            accountLine: [
              student.email,
              student.phone,
              student.studentProfile?.nationalId,
              student.studentProfile?.bankName,
              student.studentProfile?.bankBranch,
              student.studentProfile?.bankAccountNumber,
              student.studentProfile?.hasBankConfirmation ? "אישור" : "",
            ].filter(Boolean).join(" · "),
            account: {
              id: student.id,
              email: student.email,
              phone: student.phone,
              nationalId: student.studentProfile?.nationalId ?? null,
              bankName: student.studentProfile?.bankName ?? null,
              bankBranch: student.studentProfile?.bankBranch ?? null,
              bankAccount: student.studentProfile?.bankAccountNumber ?? null,
              bankConfirmed: student.studentProfile?.hasBankConfirmation ?? false,
            },
          };
        })}
        summary={people.map((student) => ({
          studentId: student.id,
          name: fullName(student),
          months: student.stipendPayments.length,
          assigned: student.stipendPayments.reduce((sum, payment) => sum + asNumber(payment.finalAmount), 0),
          paid: student.stipendPayments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + asNumber(payment.finalAmount), 0),
        }))}
        ownRows={own.map((payment) => ({
          id: payment.id,
          periodLabel: `${String(payment.month).padStart(2, "0")}/${payment.year}`,
          amount: asNumber(payment.finalAmount),
          base: asNumber(payment.baseAmount),
          deduction: asNumber(payment.deductionAmount),
          bonus: asNumber(payment.bonusAmount),
          status: payment.status,
          notes: payment.notes ?? "",
          paidLabel: payment.paidAt ? formatDate(payment.paidAt, locale) : "",
        }))}
      />
    </div>
  );
}
