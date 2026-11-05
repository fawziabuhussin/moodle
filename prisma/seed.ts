import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { hash } from "bcryptjs";
import ws from "ws";
import { PERMISSIONS } from "../src/lib/permissions";
import { syncRealRoster } from "../src/server/roster-sync";
export { COHORT_26_27_STUDENTS } from "./data/cohort-26-27";
import { attendanceSnapshot, computeStipend } from "../src/lib/stipends";
import { calendarDateFromISO, evaluateArrival, todayISO, zonedDateTime } from "../src/lib/time";
import { DASHBOARD_ANNOUNCEMENTS, WEEK_PLAN } from "./data/week-plan";

neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DIRECT_URL or DATABASE_URL before seeding.");
}

function isLocalPostgres(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const prisma = isLocalPostgres(connectionString)
  ? new PrismaClient({ datasources: { db: { url: connectionString } } })
  : new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const ALL = [...PERMISSIONS];

function nextWeekday(iso: string, weekday: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(iso, delta);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const managerRole = await prisma.role.upsert({
    where: { slug: "manager" },
    update: { name: "מנהל", isSystem: true, permissions: ALL, description: "Full institution access" },
    create: { name: "מנהל", slug: "manager", isSystem: true, permissions: ALL, description: "Full institution access" },
  });
  const teacherRole = await prisma.role.upsert({
    where: { slug: "teacher" },
    update: {
      name: "מורה",
      isSystem: true,
      permissions: ["post_course_feed", "manage_exams_and_grades", "manage_attendance", "configure_attendance_settings", "manage_private_sessions"],
    },
    create: {
      name: "מורה",
      slug: "teacher",
      isSystem: true,
      permissions: ["post_course_feed", "manage_exams_and_grades", "manage_attendance", "configure_attendance_settings", "manage_private_sessions"],
    },
  });
  const studentRole = await prisma.role.upsert({
    where: { slug: "student" },
    update: { name: "תלמיד", isSystem: true, permissions: [] },
    create: { name: "תלמיד", slug: "student", isSystem: true, permissions: [] },
  });
  const coordinator = await prisma.role.upsert({
    where: { slug: "coordinator" },
    update: { name: "רכז", permissions: ["manage_courses", "manage_attendance", "manage_private_sessions", "post_course_feed"] },
    create: { name: "רכז", slug: "coordinator", permissions: ["manage_courses", "manage_attendance", "manage_private_sessions", "post_course_feed"], description: "Coordinator" },
  });
  const mentor = await prisma.role.upsert({
    where: { slug: "mentor" },
    update: { name: "מנטור", permissions: ["manage_private_sessions", "post_course_feed"] },
    create: { name: "מנטור", slug: "mentor", permissions: ["manage_private_sessions", "post_course_feed"], description: "Mentor" },
  });
  const finance = await prisma.role.upsert({
    where: { slug: "finance-admin" },
    update: { name: "מנהל מלגות", permissions: ["manage_stipends"] },
    create: { name: "מנהל מלגות", slug: "finance-admin", permissions: ["manage_stipends"], description: "Finance admin" },
  });
  await prisma.role.upsert({
    where: { slug: "assistant" },
    update: { name: "עוזר הוראה", permissions: ["manage_attendance", "post_course_feed"] },
    create: { name: "עוזר הוראה", slug: "assistant", permissions: ["manage_attendance", "post_course_feed"], description: "Teaching assistant" },
  });

  async function upsertUser(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    locale?: string;
    roleId: string;
    hardwareBadgeId?: string;
    terminalPin?: string;
    profile?: {
      nationalId?: string;
      academicTrack?: string;
      city?: string;
      defaultStipendAmount?: number;
      bankName?: string;
      bankAccountNumber?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    };
  }) {
    const passwordHash = await hash(input.password, 10);
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        locale: input.locale ?? "he",
        isActive: true,
        hardwareBadgeId: input.hardwareBadgeId,
        terminalPin: input.terminalPin,
        roles: { deleteMany: {}, create: [{ roleId: input.roleId }] },
      },
      create: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        locale: input.locale ?? "he",
        hardwareBadgeId: input.hardwareBadgeId,
        terminalPin: input.terminalPin,
        roles: { create: [{ roleId: input.roleId }] },
      },
    });
    if (input.profile) {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: input.profile,
        create: { userId: user.id, ...input.profile },
      });
    }
    return user;
  }

  const noa = await upsertUser({
    email: "manager@entilaka.local",
    password: "Manager123!",
    firstName: "נועה",
    lastName: "לוי",
    phone: "050-100-0001",
    roleId: managerRole.id,
  });
  const yael = await upsertUser({
    email: "teacher@entilaka.local",
    password: "Teacher123!",
    firstName: "יעל",
    lastName: "מזרחי",
    phone: "050-100-0002",
    roleId: teacherRole.id,
  });
  const omar = await upsertUser({
    email: "teacher.ar@entilaka.local",
    password: "Teacher123!",
    firstName: "عمر",
    lastName: "حداد",
    phone: "050-100-0003",
    locale: "ar",
    roleId: teacherRole.id,
  });
  await upsertUser({
    email: "finance@entilaka.local",
    password: "Finance123!",
    firstName: "דנה",
    lastName: "אזולאי",
    roleId: finance.id,
  });
  await upsertUser({
    email: "mentor@entilaka.local",
    password: "Mentor123!",
    firstName: "רועי",
    lastName: "חדד",
    roleId: mentor.id,
  });

  const adam = await upsertUser({
    email: "student@entilaka.local",
    password: "Student123!",
    firstName: "אדם",
    lastName: "שלו",
    phone: "052-200-1001",
    roleId: studentRole.id,
    hardwareBadgeId: "STU-1001",
    terminalPin: "1001",
    profile: {
      nationalId: "123456789",
      academicTrack: "מגמת מתמטיקה",
      city: "חיפה",
      defaultStipendAmount: 1200,
      bankName: "הפועלים",
      bankAccountNumber: "123456",
      emergencyContactName: "מיכל שלו",
      emergencyContactPhone: "052-200-9001",
    },
  });
  const lina = await upsertUser({
    email: "student2@entilaka.local",
    password: "Student123!",
    firstName: "لينا",
    lastName: "خوري",
    locale: "ar",
    roleId: studentRole.id,
    hardwareBadgeId: "STU-1002",
    terminalPin: "1002",
    profile: { academicTrack: "مسار اللغة", city: "الناصرة", defaultStipendAmount: 1100 },
  });
  const maya = await upsertUser({
    email: "student3@entilaka.local",
    password: "Student123!",
    firstName: "מאיה",
    lastName: "בר",
    roleId: studentRole.id,
    hardwareBadgeId: "STU-1003",
    terminalPin: "1003",
    profile: { academicTrack: "מגמת פיזיקה", city: "תל אביב", defaultStipendAmount: 1000 },
  });
  const yusuf = await upsertUser({
    email: "student4@entilaka.local",
    password: "Student123!",
    firstName: "يوسف",
    lastName: "ناصر",
    locale: "ar",
    roleId: studentRole.id,
    hardwareBadgeId: "STU-1004",
    terminalPin: "1004",
    profile: { academicTrack: "مسار العلوم", city: "عكا", defaultStipendAmount: 1000 },
  });

  const math = await prisma.course.upsert({
    where: { code: "MATH-101" },
    update: { title: "מתמטיקה מואצת", description: "אלגברה וחשיבה כמותית", isActive: true },
    create: { code: "MATH-101", title: "מתמטיקה מואצת", description: "אלגברה וחשיבה כמותית" },
  });
  const arabic = await prisma.course.upsert({
    where: { code: "ARAB-201" },
    update: { title: "اللغة العربية", description: "نصوص وتعبير", isActive: true },
    create: { code: "ARAB-201", title: "اللغة العربية", description: "نصوص وتعبير" },
  });
  const physics = await prisma.course.upsert({
    where: { code: "PHYS-110" },
    update: { title: "פיזיקה", description: "מכניקה בסיסית", isActive: true },
    create: { code: "PHYS-110", title: "פיזיקה", description: "מכניקה בסיסית" },
  });

  await prisma.courseTeacher.deleteMany({ where: { courseId: { in: [math.id, arabic.id, physics.id] } } });
  await prisma.courseTeacher.createMany({
    data: [
      { courseId: math.id, userId: yael.id },
      { courseId: physics.id, userId: yael.id },
      { courseId: arabic.id, userId: omar.id },
    ],
  });
  await prisma.courseEnrollment.deleteMany({ where: { courseId: { in: [math.id, arabic.id, physics.id] } } });
  await prisma.courseEnrollment.createMany({
    data: [
      { courseId: math.id, userId: adam.id },
      { courseId: math.id, userId: lina.id },
      { courseId: math.id, userId: maya.id },
      { courseId: math.id, userId: yusuf.id },
      { courseId: arabic.id, userId: lina.id },
      { courseId: arabic.id, userId: yusuf.id },
      { courseId: physics.id, userId: adam.id },
      { courseId: physics.id, userId: maya.id },
      { courseId: physics.id, userId: yusuf.id },
    ],
  });

  await prisma.attendanceSetting.upsert({
    where: { scopeKey: "global" },
    update: { isGlobal: true, officialStartTime: "16:00", lateGraceMinutes: 10, autoCheckoutTime: "20:30" },
    create: { scopeKey: "global", isGlobal: true, officialStartTime: "16:00", lateGraceMinutes: 10, autoCheckoutTime: "20:30" },
  });
  await prisma.attendanceSetting.upsert({
    where: { scopeKey: physics.id },
    update: { courseId: physics.id, officialStartTime: "17:00", lateGraceMinutes: 5, isGlobal: false },
    create: { scopeKey: physics.id, courseId: physics.id, officialStartTime: "17:00", lateGraceMinutes: 5, isGlobal: false },
  });

  const today = todayISO();
  const timed = [
    { userId: adam.id, day: today, time: "15:50", out: "19:10" as string | null },
    { userId: lina.id, day: today, time: "16:25", out: null },
  ];
  for (const sample of timed) {
    const checkIn = zonedDateTime(sample.day, sample.time);
    const arrival = evaluateArrival(checkIn, "16:00", 10);
    const checkOut = sample.out ? zonedDateTime(sample.day, sample.out) : null;
    await prisma.attendanceRecord.upsert({
      where: { userId_date_courseScope: { userId: sample.userId, date: calendarDateFromISO(sample.day), courseScope: "none" } },
      update: {
        status: arrival.status,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        minutesLate: arrival.minutesLate,
        totalMinutes: checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null,
        source: "TERMINAL_MACHINE",
      },
      create: {
        userId: sample.userId,
        date: calendarDateFromISO(sample.day),
        courseScope: "none",
        status: arrival.status,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        minutesLate: arrival.minutesLate,
        totalMinutes: checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null,
        source: "TERMINAL_MACHINE",
      },
    });
  }

  const marked: { userId: string; day: string; status: "ABSENT" | "EXCUSED" }[] = [
    { userId: maya.id, day: addDays(today, -1), status: "ABSENT" },
    { userId: yusuf.id, day: addDays(today, -2), status: "EXCUSED" },
  ];
  for (const sample of marked) {
    await prisma.attendanceRecord.upsert({
      where: { userId_date_courseScope: { userId: sample.userId, date: calendarDateFromISO(sample.day), courseScope: "none" } },
      update: { status: sample.status, source: "MANUAL", recordedById: yael.id },
      create: {
        userId: sample.userId,
        date: calendarDateFromISO(sample.day),
        courseScope: "none",
        status: sample.status,
        source: "MANUAL",
        recordedById: yael.id,
      },
    });
  }

  const previous = new Date(`${today}T00:00:00.000Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const stipendYear = previous.getUTCFullYear();
  const stipendMonth = previous.getUTCMonth() + 1;
  const records = await prisma.attendanceRecord.findMany({ where: { userId: adam.id } });
  const snapshot = attendanceSnapshot(records);
  const amounts = computeStipend({ baseAmount: 1200, bonusAmount: 50, absenceCount: snapshot.absenceCount, lateCount: snapshot.lateCount });
  await prisma.stipendPayment.upsert({
    where: { studentId_month_year: { studentId: adam.id, month: stipendMonth, year: stipendYear } },
    update: {},
    create: {
      studentId: adam.id,
      month: stipendMonth,
      year: stipendYear,
      baseAmount: 1200,
      deductionAmount: amounts.deductionAmount,
      bonusAmount: 50,
      finalAmount: amounts.finalAmount,
      status: "PAID",
      paidAt: new Date(),
      absenceCount: snapshot.absenceCount,
      lateCount: snapshot.lateCount,
      attendancePercent: snapshot.attendancePercent,
      notes: "תשלום הדגמה",
    },
  });

  const existingPost = await prisma.coursePost.findFirst({ where: { courseId: math.id, title: "ברוכים הבאים" } });
  if (!existingPost) {
    const post = await prisma.coursePost.create({
      data: {
        courseId: math.id,
        authorId: yael.id,
        title: "ברוכים הבאים",
        body: "הפיד הזה ישמש להודעות, קישורים וחומרי לימוד.",
        isPinned: true,
        allowComments: true,
        linkUrl: "https://entilaka.example/math",
      },
    });
    await prisma.coursePostComment.create({
      data: { postId: post.id, authorId: adam.id, body: "תודה, מחכה לשיעור." },
    });
  }

  const existingExam = await prisma.exam.findFirst({ where: { courseId: math.id, title: "בוחן אלגברה" } });
  if (!existingExam) {
    const exam = await prisma.exam.create({
      data: {
        courseId: math.id,
        title: "בוחן אלגברה",
        description: "פרקים 1–2",
        examDate: zonedDateTime(addDays(today, 7), "16:30"),
        maxScore: 100,
        attachments: ["https://entilaka.example/algebra.pdf"],
        createdById: yael.id,
      },
    });
    await prisma.examGrade.create({
      data: { examId: exam.id, studentId: adam.id, score: 92, feedback: "פתרון נקי", recordedById: yael.id },
    });
  }

  const existingNotice = await prisma.notification.findFirst({ where: { title: "ברוכים הבאים לאנטלאקה" } });
  if (!existingNotice) {
    await prisma.notification.create({
      data: {
        title: "ברוכים הבאים לאנטלאקה",
        body: "ההודעות כאן מגיעות גם למכשיר ה-iOS אחרי רישום הטוקן.",
        priority: "IMPORTANT",
        audience: "ALL_STUDENTS",
        createdById: noa.id,
        linkUrl: "/notifications",
        recipients: {
          create: [adam.id, lina.id, maya.id, yusuf.id].map((userId) => ({ userId, pushStatus: "SKIPPED", pushError: "Seeded without a device token" })),
        },
      },
    });
  }

  const roster = await syncRealRoster(prisma);
  console.log(`Synced ${roster.cohort2026} students in 2026-2027 and ${roster.cohort2025} students in 2025-2026.`);

  const courseIds = new Map((await prisma.course.findMany({ select: { id: true, code: true } })).map((course) => [course.code, course.id]));
  const seasonStart = new Date("2026-09-01T00:00:00.000Z");
  const seasonEnd = new Date("2026-12-31T00:00:00.000Z");
  for (const block of WEEK_PLAN) {
    const courseCode = "courseCode" in block ? block.courseCode : undefined;
    const instructorName = "instructorName" in block ? block.instructorName : null;
    const data = {
      titleHe: block.titleHe,
      titleAr: block.titleAr,
      category: block.category,
      dayOfWeek: block.dayOfWeek,
      startTime: block.startTime,
      endTime: block.endTime,
      instructorName,
      courseId: courseCode ? courseIds.get(courseCode) ?? null : null,
      recurrenceType: "WEEKLY" as const,
      startDate: seasonStart,
      endDate: seasonEnd,
      isActive: true,
      createdById: noa.id,
    };
    await prisma.weekPlanItem.upsert({ where: { seedKey: block.seedKey }, update: data, create: { ...data, seedKey: block.seedKey } });
  }

  const currentStudents = await prisma.user.findMany({
    where: { isActive: true, OR: [{ hardwareBadgeId: { startsWith: "STU-26" } }, { studentProfile: { is: { cohort: "2026-2027" } } }] },
    select: { id: true },
  });
  for (const note of DASHBOARD_ANNOUNCEMENTS) {
    const existing = await prisma.notification.findFirst({ where: { title: note.title } });
    if (existing) {
      await prisma.notification.update({ where: { id: existing.id }, data: { body: note.body, priority: note.priority, isPinned: note.isPinned } });
      continue;
    }
    await prisma.notification.create({
      data: {
        title: note.title,
        body: note.body,
        priority: note.priority,
        isPinned: note.isPinned,
        audience: "ALL_STUDENTS",
        createdById: noa.id,
        linkUrl: "/dashboard",
        recipients: { create: currentStudents.map((student) => ({ userId: student.id, pushStatus: "SKIPPED" as const, pushError: "Seeded without a device token" })) },
      },
    });
  }

  await prisma.privateSession.deleteMany({
    where: {
      student: {
        OR: [
          { hardwareBadgeId: { startsWith: "STU-10" } },
          { studentProfile: { is: null } },
          { studentProfile: { is: { OR: [{ cohort: null }, { cohort: { not: "2026-2027" } }] } } },
        ],
      },
    },
  });
  const sessionTitle = "שיחת ליווי אישית / جلسة مرافقة فردية";
  const sessionPlan = [
    { badge: "STU-2602", day: nextWeekday(today, 0), time: "12:15" },
    { badge: "STU-2633", day: nextWeekday(today, 1), time: "12:30" },
    { badge: "STU-2609", day: nextWeekday(today, 2), time: "12:45" },
  ];
  for (const plan of sessionPlan) {
    const student = await prisma.user.findUnique({ where: { hardwareBadgeId: plan.badge }, select: { id: true } });
    if (!student) continue;
    const scheduledAt = zonedDateTime(plan.day, plan.time);
    const existing = await prisma.privateSession.findFirst({ where: { studentId: student.id, title: sessionTitle } });
    if (existing) {
      if (existing.scheduledAt < new Date()) {
        await prisma.privateSession.update({ where: { id: existing.id }, data: { scheduledAt, status: "SCHEDULED", staffId: noa.id } });
      }
      continue;
    }
    await prisma.privateSession.create({
      data: {
        studentId: student.id,
        staffId: noa.id,
        title: sessionTitle,
        scheduledAt,
        durationMinutes: 30,
        locationOrLink: "חדר הייעוץ",
        agenda: sessionTitle,
      },
    });
  }
  console.log("Seeded Entilaka demo data.");
  console.log("manager@entilaka.local / Manager123!");
  console.log("teacher@entilaka.local / Teacher123!");
  console.log("student@entilaka.local / Student123!  badge STU-1001");
  void coordinator;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
