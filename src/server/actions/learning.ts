"use server";

import { revalidatePath } from "next/cache";
import { loadCourseForSession } from "@/lib/access";
import { activeStudentWhere } from "@/lib/cohort";
import { getLocale, requirePermission, requireUser } from "@/lib/auth";
import { asNumber, formatDateTime } from "@/lib/format";
import { field, isEmail, lines, optional } from "@/lib/form";
import { fill, getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { notifyUsers, recipientIdsForAudience } from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone, parseDateTimeLocal } from "@/lib/time";
import type { ActionState } from "@/lib/types";
import { safeHttpUrl } from "@/lib/utils";

async function editableCourse(courseId: string) {
  const session = await requireUser();
  const access = await loadCourseForSession(session, courseId);
  if (!access) return null;
  const canManage = access.isManager;
  const canTeach = access.isTeacher || access.isManager;
  return { session, access, canManage, canTeach };
}

export async function createCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_courses");
  const dict = getDictionary(await getLocale());
  const code = field(formData, "code").toUpperCase();
  const title = field(formData, "title");
  if (!code || !title) return { error: dict.errors.invalid };
  try {
    await getPrisma().course.create({
      data: { code, title, description: optional(formData, "description") },
    });
  } catch {
    return { error: dict.errors.invalid };
  }
  revalidatePath("/courses");
  return { success: dict.common.saved };
}

export async function saveRosterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_courses");
  const dict = getDictionary(await getLocale());
  const courseId = field(formData, "courseId");
  const teacherIds = formData.getAll("teacherIds").map(String);
  const studentIds = new Set(formData.getAll("studentIds").map(String));
  const emails = lines(field(formData, "emails")).filter(isEmail);
  if (!courseId) return { error: dict.errors.invalid };
  const db = getPrisma();
  if (emails.length) {
    const matches = await db.user.findMany({ where: { email: { in: emails }, ...activeStudentWhere() }, select: { id: true } });
    matches.forEach((user) => studentIds.add(user.id));
  }
  const activeIds = studentIds.size
    ? await db.user.findMany({ where: { id: { in: [...studentIds] }, ...activeStudentWhere() }, select: { id: true } })
    : [];
  const preserved = await db.courseEnrollment.findMany({
    where: { courseId, user: { NOT: activeStudentWhere() } },
    select: { userId: true },
  });
  const nextStudentIds = [...new Set([...activeIds.map((user) => user.id), ...preserved.map((row) => row.userId)])];
  await db.courseTeacher.deleteMany({ where: { courseId } });
  if (teacherIds.length) {
    await db.courseTeacher.createMany({ data: teacherIds.map((userId) => ({ courseId, userId })), skipDuplicates: true });
  }
  await db.courseEnrollment.deleteMany({ where: { courseId } });
  if (nextStudentIds.length) {
    await db.courseEnrollment.createMany({
      data: nextStudentIds.map((userId) => ({ courseId, userId })),
      skipDuplicates: true,
    });
  }
  revalidatePath(`/courses/${courseId}`);
  return { success: dict.common.saved };
}

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const courseId = field(formData, "courseId");
  const body = field(formData, "body");
  const context = await editableCourse(courseId);
  if (!context || !context.canTeach || !hasPermission(context.session.permissions, "post_course_feed")) {
    return { error: dict.errors.forbidden };
  }
  if (!body) return { error: dict.errors.invalid };
  const link = optional(formData, "linkUrl");
  if (link && !safeHttpUrl(link)) return { error: dict.errors.invalid };
  await getPrisma().coursePost.create({
    data: {
      courseId,
      authorId: context.session.id,
      title: optional(formData, "title"),
      body,
      linkUrl: link,
      isPinned: formData.get("isPinned") === "on",
      allowComments: formData.get("allowComments") === "on",
    },
  });
  revalidatePath(`/courses/${courseId}`);
  return { success: dict.common.saved };
}

export async function togglePinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const postId = field(formData, "postId");
  const post = await getPrisma().coursePost.findUnique({ where: { id: postId } });
  if (!post) return { error: dict.errors.invalid };
  const context = await editableCourse(post.courseId);
  if (!context?.canTeach) return { error: dict.errors.forbidden };
  await getPrisma().coursePost.update({ where: { id: postId }, data: { isPinned: !post.isPinned } });
  revalidatePath(`/courses/${post.courseId}`);
  return { success: dict.common.saved };
}

export async function addCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  const postId = field(formData, "postId");
  const body = field(formData, "body");
  const post = await getPrisma().coursePost.findUnique({ where: { id: postId } });
  if (!post || !post.allowComments || !body) return { error: dict.errors.invalid };
  const access = await loadCourseForSession(session, post.courseId);
  if (!access || (!access.isEnrolled && !access.isTeacher && !access.isManager)) return { error: dict.errors.forbidden };
  await getPrisma().coursePostComment.create({ data: { postId, authorId: session.id, body } });
  revalidatePath(`/courses/${post.courseId}`);
  return { success: dict.common.saved };
}

export async function createExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const courseId = field(formData, "courseId");
  const title = field(formData, "title");
  const examDate = parseDateTimeLocal(field(formData, "examDate"));
  const maxScore = Number(field(formData, "maxScore") || "100");
  const context = await editableCourse(courseId);
  if (!context?.canTeach || !hasPermission(context.session.permissions, "manage_exams_and_grades")) {
    return { error: dict.errors.forbidden };
  }
  if (!title || !examDate || !Number.isFinite(maxScore) || maxScore <= 0) return { error: dict.errors.invalid };
  const attachments = field(formData, "attachments")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const exam = await getPrisma().exam.create({
    data: {
      courseId,
      title,
      description: optional(formData, "description"),
      examDate,
      maxScore,
      attachments,
      createdById: context.session.id,
    },
  });
  const enrolled = await getPrisma().courseEnrollment.findMany({ where: { courseId, user: activeStudentWhere() }, select: { userId: true } });
  if (enrolled.length > 0) {
    await getPrisma().examGrade.createMany({
      data: enrolled.map((row) => ({ examId: exam.id, studentId: row.userId })),
      skipDuplicates: true,
    });
  }
  const recipients = await recipientIdsForAudience("COURSE", { courseId });
  const locale = await getLocale();
  await notifyUsers({
    recipientIds: recipients,
    title: fill(dict.courses.examNotice, { exam: title }),
    body: fill(dict.courses.examNoticeBody, {
      course: context.access.course.title,
      date: formatDateTime(examDate, locale, appTimeZone()),
    }),
    audience: "COURSE",
    courseId,
    createdById: context.session.id,
    linkUrl: `/courses/${courseId}?tab=exams`,
    priority: "IMPORTANT",
  });
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/notifications");
  return { success: dict.common.saved };
}

export async function saveGradesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const examId = field(formData, "examId");
  const exam = await getPrisma().exam.findUnique({
    where: { id: examId },
    include: { course: { include: { enrollments: true } } },
  });
  if (!exam) return { error: dict.errors.invalid };
  const context = await editableCourse(exam.courseId);
  if (!context?.canTeach || !hasPermission(context.session.permissions, "manage_exams_and_grades")) {
    return { error: dict.errors.forbidden };
  }
  const max = asNumber(exam.maxScore);
  for (const enrollment of exam.course.enrollments) {
    const raw = field(formData, `score:${enrollment.userId}`);
    const feedback = optional(formData, `feedback:${enrollment.userId}`);
    if (!raw && !feedback) continue;
    const score = raw ? Number(raw) : null;
    if (score != null && (!Number.isFinite(score) || score < 0 || score > max)) return { error: dict.errors.invalid };
    await getPrisma().examGrade.upsert({
      where: { examId_studentId: { examId, studentId: enrollment.userId } },
      create: { examId, studentId: enrollment.userId, score, feedback, recordedById: context.session.id },
      update: { score, feedback, recordedById: context.session.id },
    });
  }
  revalidatePath(`/courses/${exam.courseId}`);
  return { success: dict.common.saved };
}

export async function broadcastCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dict = getDictionary(await getLocale());
  const courseId = field(formData, "courseId");
  const title = field(formData, "title");
  const body = field(formData, "body");
  const context = await editableCourse(courseId);
  if (!context?.canTeach || !hasPermission(context.session.permissions, "post_course_feed")) {
    return { error: dict.errors.forbidden };
  }
  if (!title || !body) return { error: dict.errors.invalid };
  const recipients = await recipientIdsForAudience("COURSE", { courseId });
  await notifyUsers({
    recipientIds: recipients,
    title,
    body,
    audience: "COURSE",
    courseId,
    createdById: context.session.id,
    linkUrl: `/courses/${courseId}`,
    priority: "IMPORTANT",
  });
  revalidatePath("/notifications");
  return { success: dict.courses.sent };
}
