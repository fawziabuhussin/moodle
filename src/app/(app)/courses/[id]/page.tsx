import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr, Timestamp } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { loadCourseForSession } from "@/lib/access";
import { activeStudentWhere, isCurrentYearStudent } from "@/lib/cohort";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { asNumber } from "@/lib/format";
import { fill, getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone } from "@/lib/time";
import { fullName, safeHttpUrl } from "@/lib/utils";
import {
  addCommentAction,
  broadcastCourseAction,
  createExamAction,
  createPostAction,
  saveGradesAction,
  saveRosterAction,
  togglePinAction,
} from "@/server/actions/learning";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const { id } = await params;
  const access = await loadCourseForSession(session, id);
  if (!access) notFound();
  const { course, isTeacher, isManager } = access;
  const canPost = (isTeacher || isManager) && hasPermission(session.permissions, "post_course_feed");
  const canGrade = (isTeacher || isManager) && hasPermission(session.permissions, "manage_exams_and_grades");
  const canManage = isManager;
  const requested = (await searchParams).tab;
  const tab = requested === "roster" && canManage ? "roster" : requested === "exams" ? "exams" : requested === "broadcast" && canPost ? "broadcast" : "feed";
  const db = getPrisma();
  const [posts, exams, teachers, students] = await Promise.all([
    db.coursePost.findMany({
      where: { courseId: id },
      include: { author: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    }),
    db.exam.findMany({
      where: { courseId: id },
      include: { grades: true },
      orderBy: { examDate: "asc" },
    }),
    canManage ? db.user.findMany({ where: { isActive: true, roles: { some: { role: { slug: "teacher" } } } }, orderBy: { firstName: "asc" } }) : Promise.resolve([]),
    canManage ? db.user.findMany({ where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } }, orderBy: { firstName: "asc" } }) : Promise.resolve([]),
  ]);
  const teacherIds = new Set(course.teachers.map((teacher) => teacher.userId));
  const activeEnrollments = course.enrollments.filter((enrollment) => isCurrentYearStudent(enrollment.user));
  const studentIds = new Set(activeEnrollments.map((enrollment) => enrollment.userId));
  const base = `/courses/${course.id}`;

  return (
    <div>
      <PageHeader title={course.title} description={<><Ltr>{course.code}</Ltr>{course.description ? ` · ${course.description}` : ""}</>} />
      <TabLinks
        current={tab}
        tabs={[
          { key: "feed", href: base, label: dict.courses.feed },
          ...(canManage ? [{ key: "roster", href: `${base}?tab=roster`, label: dict.courses.roster }] : []),
          { key: "exams", href: `${base}?tab=exams`, label: dict.courses.exams },
          ...(canPost ? [{ key: "broadcast", href: `${base}?tab=broadcast`, label: dict.courses.broadcast }] : []),
        ]}
      />

      {tab === "feed" ? (
        <div className="grid gap-4">
          {canPost ? (
            <ActionForm action={createPostAction} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="title" placeholder={dict.courses.postTitle} />
              <Textarea name="body" placeholder={dict.courses.postBody} required />
              <Input name="linkUrl" placeholder={dict.courses.link} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowComments" defaultChecked /> {dict.courses.allowComments}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPinned" /> {dict.courses.pin}</label>
              <SubmitButton label={dict.common.add} pendingLabel={dict.common.saving} />
            </ActionForm>
          ) : null}
          {posts.length === 0 ? <p className="text-sm text-muted-foreground">{dict.courses.noPosts}</p> : null}
          {posts.map((post) => {
            const link = safeHttpUrl(post.linkUrl);
            return (
              <article key={post.id} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {post.isPinned ? <Badge tone="IMPORTANT">{dict.courses.pin}</Badge> : null}
                    {post.title ? <h2 className="mt-1 font-semibold">{post.title}</h2> : null}
                    <p className="text-xs text-muted-foreground">{fullName(post.author)} · <Timestamp value={post.createdAt} locale={locale} timeZone={appTimeZone()} /></p>
                  </div>
                  {canPost ? (
                    <ActionForm action={togglePinAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <SubmitButton label={post.isPinned ? dict.courses.unpin : dict.courses.pin} pendingLabel={dict.common.saving} variant="outline" size="sm" />
                    </ActionForm>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
                {link ? <a href={link} className="mt-2 block break-all text-sm text-primary">{link}</a> : null}
                <div className="mt-3 grid gap-2">
                  {post.comments.map((comment) => (
                    <p key={comment.id} className="rounded-xl bg-secondary px-3 py-2 text-sm">
                      <span className="font-medium">{fullName(comment.author)}: </span>
                      {comment.body}
                    </p>
                  ))}
                </div>
                {post.allowComments ? (
                  <ActionForm action={addCommentAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="postId" value={post.id} />
                    <Input name="body" placeholder={dict.courses.comment} required />
                    <SubmitButton label={dict.courses.addComment} pendingLabel={dict.common.saving} />
                  </ActionForm>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "roster" && canManage ? (
        <ActionForm action={saveRosterAction} className="grid gap-4 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
          <input type="hidden" name="courseId" value={course.id} />
          <fieldset>
            <legend className="mb-2 font-medium">{dict.courses.teachers}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {teachers.map((teacher) => (
                <label key={teacher.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="teacherIds" value={teacher.id} defaultChecked={teacherIds.has(teacher.id)} />
                  {fullName(teacher)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-medium">{dict.courses.students}</legend>
            <div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
              {students.map((student) => (
                <label key={student.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="studentIds" value={student.id} defaultChecked={studentIds.has(student.id)} />
                  {fullName(student)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm">
            {dict.courses.emails}
            <Textarea name="emails" placeholder={dict.courses.enrollHint} />
          </label>
          <SubmitButton label={dict.courses.saveRoster} pendingLabel={dict.common.saving} />
        </ActionForm>
      ) : null}

      {tab === "exams" ? (
        <div className="grid gap-4">
          {canGrade ? (
            <ActionForm action={createExamAction} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
              <h2 className="font-semibold">{dict.courses.examTitle}</h2>
              <p className="text-sm text-muted-foreground">{fill(dict.courses.gradebookReady, { n: activeEnrollments.length })}</p>
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="title" placeholder={dict.courses.postTitle} required />
              <Textarea name="description" placeholder={dict.courses.description} />
              <Input name="examDate" type="datetime-local" required />
              <Input name="maxScore" type="number" min={1} step="0.01" defaultValue={100} />
              <Textarea name="attachments" placeholder={dict.courses.attachments} />
              <SubmitButton label={dict.courses.createExam} pendingLabel={dict.common.saving} />
            </ActionForm>
          ) : null}
          {exams.length === 0 ? <p className="text-sm text-muted-foreground">{dict.courses.noExams}</p> : null}
          {exams.map((exam) => {
            const grades = new Map(exam.grades.map((grade) => [grade.studentId, grade]));
            const visibleStudents = canGrade ? activeEnrollments : course.enrollments.filter((enrollment) => enrollment.userId === session.id);
            return (
              <article key={exam.id} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
                <h2 className="font-semibold">{exam.title}</h2>
                <p className="text-sm text-muted-foreground"><Timestamp value={exam.examDate} locale={locale} timeZone={appTimeZone()} /> · {dict.courses.maxScore} <Ltr>{asNumber(exam.maxScore)}</Ltr></p>
                {exam.description ? <p className="mt-2 text-sm">{exam.description}</p> : null}
                <ul className="mt-2 text-sm">
                  {exam.attachments.map((attachment) => {
                    const href = safeHttpUrl(attachment);
                    return <li key={attachment} className="break-all">{href ? <a className="text-primary" href={href}>{href}</a> : attachment}</li>;
                  })}
                </ul>
                {canGrade ? (
                  <ActionForm action={saveGradesAction} className="mt-3 grid gap-2">
                    <h3 className="text-sm font-medium">{dict.courses.gradebook} · <Ltr>{visibleStudents.length}</Ltr></h3>
                    <input type="hidden" name="examId" value={exam.id} />
                    {visibleStudents.map((enrollment) => {
                      const grade = grades.get(enrollment.userId);
                      return (
                        <div key={enrollment.userId} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr]">
                          <p className="self-center text-sm">{fullName(enrollment.user)}</p>
                          <Input name={`score:${enrollment.userId}`} type="number" min={0} max={asNumber(exam.maxScore)} step="0.01" defaultValue={grade?.score == null ? "" : asNumber(grade.score)} placeholder={dict.courses.score} />
                          <Input name={`feedback:${enrollment.userId}`} defaultValue={grade?.feedback ?? ""} placeholder={dict.courses.feedback} />
                        </div>
                      );
                    })}
                    <SubmitButton label={dict.courses.saveGrades} pendingLabel={dict.common.saving} />
                  </ActionForm>
                ) : (
                  <p className="mt-3 text-sm">
                    {grades.get(session.id)?.score == null ? dict.courses.notGraded : <>{dict.courses.score}: <Ltr>{asNumber(grades.get(session.id)?.score)} / {asNumber(exam.maxScore)}</Ltr></>}
                    {grades.get(session.id)?.feedback ? ` · ${grades.get(session.id)?.feedback}` : ""}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "broadcast" && canPost ? (
        <ActionForm action={broadcastCourseAction} className="grid max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{fill(dict.courses.broadcastTo, { n: activeEnrollments.length })}</p>
          <input type="hidden" name="courseId" value={course.id} />
          <Input name="title" placeholder={dict.courses.broadcastTitle} required />
          <Textarea name="body" placeholder={dict.courses.broadcastBody} required />
          <SubmitButton label={dict.courses.send} pendingLabel={dict.common.saving} />
        </ActionForm>
      ) : null}
    </div>
  );
}
