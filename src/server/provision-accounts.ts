import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ENTILAKA_2026_2027_ACCOUNTS } from "../../prisma/data/accounts-26-27";

const TRACK_COURSES = ["PSY-800", "PSY-BASE", "PY-AI", "HEB-YAEL", "LEAD", "VOL"] as const;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || name, lastName: parts.slice(1).join(" ") || "—" };
}

function parseDob(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function blank(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function provisionCohortAccounts(db: PrismaClient) {
  const ids = ENTILAKA_2026_2027_ACCOUNTS.map((student) => student.nationalId);
  const emails = ENTILAKA_2026_2027_ACCOUNTS.map((student) => student.email.toLowerCase());
  const badges = ENTILAKA_2026_2027_ACCOUNTS.map((student) => student.badgeId);
  if (new Set(ids).size !== ids.length || new Set(emails).size !== emails.length || new Set(badges).size !== badges.length) {
    throw new Error("Cohort accounts contain a duplicate id, email, or badge.");
  }
  const studentRole = await db.role.findUnique({ where: { slug: "student" } });
  if (!studentRole) throw new Error("Student role is missing.");

  let created = 0;
  let updated = 0;
  const userIds: string[] = [];

  for (const student of ENTILAKA_2026_2027_ACCOUNTS) {
    const email = student.email.trim().toLowerCase();
    const names = splitName(student.nameHe);
    const profile = {
      nationalId: student.nationalId,
      nameHe: student.nameHe,
      nameAr: student.nameAr,
      dateOfBirth: parseDob(student.dob),
      city: student.city,
      academicTrack: student.track,
      cohort: "2026-2027",
      psychometryTrack: student.psychometryTrack,
      volunteeringPlace: student.volunteering,
      stipendApproval: student.stipendStatus,
      hasBankConfirmation: student.hasBankConfirmation,
      bankName: blank(student.bankName),
      bankBranch: blank(student.bankBranch),
      bankAccountNumber: blank(student.bankAccountNumber),
    };
    const existing = await db.user.findFirst({
      where: { studentProfile: { is: { nationalId: student.nationalId } } },
      select: { id: true },
    });
    await db.user.updateMany({
      where: { hardwareBadgeId: student.badgeId, ...(existing ? { NOT: { id: existing.id } } : {}) },
      data: { hardwareBadgeId: null },
    });
    const emailOwner = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner && emailOwner.id !== existing?.id) {
      await db.user.update({
        where: { id: emailOwner.id },
        data: { email: `archived-${emailOwner.id}@entilaka.local` },
      });
    }
    const passwordHash = await hash(student.nationalId, 10);
    if (!existing) {
      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          loginPassword: student.nationalId,
          firstName: names.firstName,
          lastName: names.lastName,
          phone: student.phone,
          locale: "ar",
          isActive: true,
          hardwareBadgeId: student.badgeId,
          studentProfile: { create: profile },
          roles: { create: { roleId: studentRole.id } },
        },
        select: { id: true },
      });
      userIds.push(user.id);
      created += 1;
      continue;
    }
    await db.user.update({
      where: { id: existing.id },
      data: {
        email,
        passwordHash,
        loginPassword: student.nationalId,
        firstName: names.firstName,
        lastName: names.lastName,
        phone: student.phone,
        isActive: true,
        hardwareBadgeId: student.badgeId,
        studentProfile: { upsert: { create: profile, update: profile } },
        roles: { upsert: { where: { userId_roleId: { userId: existing.id, roleId: studentRole.id } }, create: { roleId: studentRole.id }, update: {} } },
      },
    });
    userIds.push(existing.id);
    updated += 1;
  }

  const courses = await db.course.findMany({ where: { code: { in: [...TRACK_COURSES] } }, select: { id: true, code: true } });
  const courseId = new Map(courses.map((course) => [course.code, course.id]));
  if (courseId.size > 0) {
    await db.courseEnrollment.deleteMany({
      where: { userId: { in: userIds }, courseId: { in: [...courseId.values()] } },
    });
    const enrollments: { courseId: string; userId: string }[] = [];
    ENTILAKA_2026_2027_ACCOUNTS.forEach((student, index) => {
      const userId = userIds[index];
      const codes = student.psychometryTrack === "800" ? ["PSY-800", "PY-AI", "HEB-YAEL", "LEAD", "VOL"] : ["PSY-BASE", "PY-AI", "HEB-YAEL", "LEAD", "VOL"];
      for (const code of codes) {
        const id = courseId.get(code);
        if (id) enrollments.push({ courseId: id, userId });
      }
    });
    if (enrollments.length > 0) await db.courseEnrollment.createMany({ data: enrollments, skipDuplicates: true });
  }

  return { count: userIds.length, created, updated };
}
