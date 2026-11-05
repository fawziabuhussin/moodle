import { ENTILAKA_2026_2027_ACCOUNTS } from "./accounts-26-27";

export const COHORT_26_27_STUDENTS = ENTILAKA_2026_2027_ACCOUNTS.map((student) => ({
  badgeId: student.badgeId,
  nameAr: student.nameAr,
  nameHe: student.nameHe,
  nationalId: student.nationalId,
  email: student.email,
  phone: student.phone,
  dob: student.dob,
  track: student.track,
  city: student.city,
  psychometryTrack: student.psychometryTrack,
  volunteering: student.volunteering,
  stipendApproval: student.stipendStatus,
  hasBankConfirmation: student.hasBankConfirmation,
  bankName: student.bankName,
  bankBranch: student.bankBranch,
  bankAccount: student.bankAccountNumber,
}));
