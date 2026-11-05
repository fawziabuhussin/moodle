import { roundMoney } from "@/lib/format";

export const STIPEND_SCHOOL_DAYS = 20;

export function attendanceSnapshot(
  records: { status: "ATTENDED" | "LATE" | "ABSENT" | "EXCUSED" }[],
) {
  const excused = records.filter((record) => record.status === "EXCUSED").length;
  const counted = records.filter((record) => record.status !== "EXCUSED");
  const lateCount = records.filter((record) => record.status === "LATE").length;
  const absenceCount = records.filter((record) => record.status === "ABSENT").length;
  const present = counted.filter((record) => record.status === "ATTENDED" || record.status === "LATE").length;
  const attendancePercent = counted.length ? roundMoney((present / counted.length) * 100) : null;
  return { excused, lateCount, absenceCount, attendancePercent, total: records.length };
}

export function computeStipend(input: {
  baseAmount: number;
  bonusAmount: number;
  absenceCount: number;
  lateCount: number;
  schoolDays?: number;
  volunteeringCompliant?: boolean;
}) {
  const schoolDays = input.schoolDays ?? STIPEND_SCHOOL_DAYS;
  const perDay = schoolDays > 0 ? input.baseAmount / schoolDays : 0;
  const volunteerDays = input.volunteeringCompliant === false ? 1 : 0;
  const rawDeduction = (input.absenceCount + volunteerDays) * perDay + input.lateCount * (perDay / 2);
  const deductionAmount = roundMoney(Math.min(Math.max(input.baseAmount, 0), Math.max(rawDeduction, 0)));
  const finalAmount = roundMoney(Math.max(0, input.baseAmount - deductionAmount + input.bonusAmount));
  return { deductionAmount, finalAmount, volunteerDays };
}
