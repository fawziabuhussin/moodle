import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StipendSheet } from "@/components/stipends/sheet";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { asNumber } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { activeStudentWhere } from "@/lib/cohort";
import { currentPeriod } from "@/lib/time";
import { fullName } from "@/lib/utils";

export default async function StipendsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const manager = hasPermission(session.permissions, "manage_stipends");
  const isStudent = session.roleSlugs.includes("student");
  if (!manager && !isStudent) redirect("/dashboard?notice=forbidden");
  const now = currentPeriod();
  const requested = (await searchParams).period;
  const match = requested && /^(\d{4})-(\d{2})$/.test(requested) ? requested : `${now.year}-${String(now.month).padStart(2, "0")}`;
  const [year, month] = match.split("-").map(Number);
  const payments = await getPrisma().stipendPayment.findMany({
    where: manager ? { year, month, student: activeStudentWhere() } : { studentId: session.id },
    include: { student: { include: { studentProfile: { select: { volunteeringPlace: true } } } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { student: { firstName: "asc" } }],
  });

  return (
    <div>
      <PageHeader title={manager ? dict.stipends.title : dict.stipends.ownTitle} description={manager ? dict.stipends.subtitle : dict.stipends.ownSubtitle} />
      <StipendSheet
        mode={manager ? "manage" : "own"}
        period={match}
        locale={locale}
        rows={payments.map((payment) => ({
          id: payment.id,
          name: fullName(payment.student),
          periodLabel: `${String(payment.month).padStart(2, "0")}/${payment.year}`,
          attendancePercent: payment.attendancePercent == null ? null : asNumber(payment.attendancePercent),
          lateCount: payment.lateCount,
          base: asNumber(payment.baseAmount),
          deduction: asNumber(payment.deductionAmount),
          bonus: asNumber(payment.bonusAmount),
          finalAmount: asNumber(payment.finalAmount),
          status: payment.status,
          notes: payment.notes ?? "",
          volunteering: Boolean(payment.student.studentProfile?.volunteeringPlace?.trim()),
        }))}
        labels={{
          search: dict.stipends.search,
          month: dict.stipends.month,
          generate: dict.stipends.generate,
          saving: dict.common.saving,
          approve: dict.stipends.approve,
          paid: dict.stipends.paid,
          bulkApprove: dict.stipends.bulkApprove,
          approvedMany: dict.stipends.approvedMany,
          saved: dict.common.saved,
          attendance: dict.stipends.attendance,
          lates: dict.stipends.lates,
          base: dict.stipends.base,
          deduction: dict.stipends.deduction,
          bonus: dict.stipends.bonus,
          final: dict.stipends.final,
          status: dict.common.status,
          name: dict.common.name,
          notes: dict.common.notes,
          edit: dict.common.edit,
          close: dict.attendance.close,
          save: dict.common.save,
          none: dict.stipends.none,
          noMatches: dict.attendance.noMatches,
          formula: dict.stipends.formula,
          select: dict.stipends.select,
          bulkPay: dict.stipends.bulkPay,
          paidMany: dict.stipends.paidMany,
          volunteering: dict.stipends.volunteering,
          volunteerYes: dict.stipends.volunteerYes,
          volunteerNo: dict.stipends.volunteerNo,
          statuses: {
            PENDING: dict.status.PENDING,
            APPROVED: dict.status.APPROVED,
            PAID: dict.status.PAID,
            CANCELLED: dict.status.CANCELLED,
          },
        }}
      />
    </div>
  );
}
