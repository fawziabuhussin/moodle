import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceBoard } from "@/components/attendance/board";
import { CourseEditor } from "@/components/courses/course-editor";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr, Timestamp } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { isStudentPortal, loadCourseForSession } from "@/lib/access";
import { attendanceClosure, getAttendanceSetting } from "@/lib/attendance";
import { activeStudentWhere, isCurrentYearStudent } from "@/lib/cohort";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { grantMatches } from "@/lib/drive-access";
import { asNumber } from "@/lib/format";
import { fill, getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone, calendarDateFromISO, formatTime, todayISO } from "@/lib/time";
import { fullName, safeHttpUrl } from "@/lib/utils";
import {
  addCommentAction,
  answerCourseQuestionAction,
  askCourseQuestionAction,
  createExamAction,
  createPostAction,
  saveGradesAction,
  saveRosterAction,
  togglePinAction,
} from "@/server/actions/learning";

type Named = { firstName: string; lastName: string; nameAr?: string | null; nameHe?: string | null };

function personName(user: Named, locale: Locale) {
  const arabic = user.nameAr?.trim() || "";
  const hebrew = user.nameHe?.trim() || fullName(user);
  return locale === "ar" ? arabic || hebrew : hebrew || arabic;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "—", lastName: parts.slice(1).join(" ") };
}

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const { id } = await params;
  const access = await loadCourseForSession(session, id);
  if (!access) notFound();
  const { course, isTeacher, isManager } = access;
  const staff = isTeacher || isManager;
  const canPost = staff && hasPermission(session.permissions, "post_course_feed");
  const canGrade = staff && hasPermission(session.permissions, "manage_exams_and_grades");
  const canAttend = staff && hasPermission(session.permissions, "manage_attendance");
  const canRoster = staff;
  const query = await searchParams;
  const requested = query.tab === "feed" || query.tab === "broadcast" ? "announcements" : query.tab === "exams" ? "grades" : query.tab;
  const allowed = new Set(staff ? ["announcements", "attendance", "grades", "questions", "content", "roster"] : ["content", "announcements", "questions", "grades"]);
  let tab = allowed.has(requested ?? "") ? requested! : staff ? "announcements" : "content";
  if (tab === "attendance" && !canAttend) tab = staff ? "announcements" : "content";
  if (tab === "roster" && !canRoster) tab = "announcements";
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : todayISO();
  const db = getPrisma();
  const activeEnrollments = course.enrollments.filter((enrollment) => isCurrentYearStudent(enrollment.user) && enrollment.user.isActive);
  const base = `/courses/${course.id}`;
  const teachers = course.teachers.map((teacher) => personName(teacher.user, locale));

  const [posts, exams, questions, driveFiles, rosterTeachers, rosterStudents, attendance] = await Promise.all([
    tab === "announcements" || tab === "content"
      ? db.coursePost.findMany({
          where: { courseId: id },
          include: { author: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    tab === "grades"
      ? db.exam.findMany({ where: { courseId: id }, include: { grades: true }, orderBy: { examDate: "asc" } })
      : Promise.resolve([]),
    tab === "questions"
      ? db.courseQuestion.findMany({
          where: { courseId: id },
          include: { author: true, answers: { include: { author: true }, orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    tab === "content"
      ? db.driveFile.findMany({ where: { allowedCourseIds: { has: id } }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "roster"
      ? db.user.findMany({ where: { isActive: true, roles: { some: { role: { slug: "teacher" } } } }, orderBy: { firstName: "asc" } })
      : Promise.resolve([]),
    tab === "roster"
      ? db.user.findMany({ where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } }, orderBy: { firstName: "asc" } })
      : Promise.resolve([]),
    tab === "attendance" && canAttend
      ? Promise.all([
          getAttendanceSetting(id),
          db.attendanceRecord.findMany({
            where: { date: calendarDateFromISO(date), courseScope: id, userId: { in: activeEnrollments.map((row) => row.userId) } },
          }),
        ])
      : Promise.resolve(null),
  ]);

  const visibleFiles = driveFiles.filter((file) =>
    grantMatches(file, { staff: !isStudentPortal(session), userId: session.id, courseIds: [id] }),
  );
  const linkedPosts = posts.filter((post) => safeHttpUrl(post.linkUrl));
  const teacherIds = new Set(course.teachers.map((teacher) => teacher.userId));
  const studentIds = new Set(activeEnrollments.map((enrollment) => enrollment.userId));
  const records = new Map((attendance?.[1] ?? []).map((record) => [record.userId, record]));
  const closure = tab === "attendance" && canAttend ? await attendanceClosure(date) : null;

  const tabs = [
    ...(staff ? [] : [{ key: "content", href: `${base}?tab=content`, label: dict.courses.content }]),
    { key: "announcements", href: `${base}?tab=announcements`, label: dict.courses.announcements },
    ...(canAttend ? [{ key: "attendance", href: `${base}?tab=attendance`, label: dict.courses.attendance }] : []),
    { key: "grades", href: `${base}?tab=grades`, label: dict.courses.grades },
    { key: "questions", href: `${base}?tab=questions`, label: dict.courses.questions },
    ...(staff ? [{ key: "content", href: `${base}?tab=content`, label: dict.courses.content }] : []),
    ...(canRoster ? [{ key: "roster", href: `${base}?tab=roster`, label: dict.courses.roster }] : []),
  ];

  return (
    <div>
      <PageHeader title={course.title} />
      <section className="mb-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-l from-indigo-600 via-blue-600 to-cyan-500" />
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"><Ltr>{course.code}</Ltr></span>
              <Badge tone={course.isActive ? "ATTENDED" : "CANCELLED"}>{course.isActive ? dict.common.active : dict.courses.inactive}</Badge>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">{fill(dict.courses.enrolledCount, { n: activeEnrollments.length })}</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{course.title}</h2>
            {course.description ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{course.description}</p> : null}
            <p className="mt-3 text-sm text-slate-500">
              {dict.courses.teacherLabel}: {teachers.length ? teachers.join(" · ") : dict.courses.noTeachers}
              {course.startDate || course.endDate ? (
                <>
                  {" · "}
                  <Ltr>{[course.startDate, course.endDate].filter(Boolean).map((value) => isoDate(value)).join(" – ")}</Ltr>
                </>
              ) : null}
            </p>
          </div>
          {staff ? (
            <div className="flex flex-wrap gap-2">
              {canRoster ? <Link href={`${base}?tab=roster`} className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">{dict.courses.manageRoster}</Link> : null}
              <CourseEditor
                key={course.updatedAt.toISOString()}
                course={{ id: course.id, code: course.code, title: course.title, description: course.description ?? "", startDate: isoDate(course.startDate), endDate: isoDate(course.endDate), isActive: course.isActive }}
                canChangeCode={isManager}
                label={dict.courses.editCourse}
                titleLabel={dict.courses.postTitle}
                codeLabel={dict.courses.code}
                descriptionLabel={dict.courses.description}
                startLabel={dict.courses.startDate}
                endLabel={dict.courses.endDate}
                activeLabel={dict.common.active}
                inactiveLabel={dict.courses.inactive}
                saveLabel={dict.common.save}
                savingLabel={dict.common.saving}
                closeLabel={dict.attendance.close}
              />
              {canPost ? <Link href={`${base}?tab=announcements`} className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">{dict.courses.publish}</Link> : null}
            </div>
          ) : null}
        </div>
      </section>

      <TabLinks current={tab} tabs={tabs} />

      {tab === "announcements" ? (
        <div className="grid gap-4">
          {canPost ? (
            <ActionForm action={createPostAction} className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">{dict.courses.publish}</h2>
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="title" placeholder={dict.courses.postTitle} />
              <Textarea name="body" placeholder={dict.courses.postBody} required />
              <Input name="linkUrl" placeholder={dict.courses.link} dir="ltr" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowComments" defaultChecked /> {dict.courses.allowComments}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPinned" /> {dict.courses.pin}</label>
              <SubmitButton label={dict.courses.publish} pendingLabel={dict.common.saving} />
            </ActionForm>
          ) : null}
          {posts.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{dict.courses.noPosts}</p> : null}
          {posts.map((post) => {
            const link = safeHttpUrl(post.linkUrl);
            return (
              <article key={post.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {post.isPinned ? <Badge tone="IMPORTANT">{dict.courses.pin}</Badge> : null}
                    {post.title ? <h2 className="mt-1 font-semibold">{post.title}</h2> : null}
                    <p className="text-xs text-slate-500">{personName(post.author, locale)} · <Ltr><Timestamp value={post.createdAt} locale={locale} timeZone={appTimeZone()} /></Ltr></p>
                  </div>
                  {canPost ? (
                    <ActionForm action={togglePinAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <SubmitButton label={post.isPinned ? dict.courses.unpin : dict.courses.pin} pendingLabel={dict.common.saving} variant="outline" size="sm" />
                    </ActionForm>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
                {link ? <a href={link} className="mt-2 block text-sm text-sky-800" dir="ltr">{link}</a> : null}
                <div className="mt-3 grid gap-2">
                  {post.comments.map((comment) => (
                    <p key={comment.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium">{personName(comment.author, locale)}: </span>
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

      {tab === "content" ? (
        <div className="grid gap-3">
          {visibleFiles.length === 0 && linkedPosts.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{dict.courses.noFiles}</p> : null}
          {visibleFiles.map((file) => {
            const external = safeHttpUrl(file.linkUrl);
            return (
              <article key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-xs text-slate-500"><Ltr>{file.kind}</Ltr></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/files/${file.slug}`} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{dict.courses.content}</Link>
                  {external ? <a href={external} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold" dir="ltr">{dict.courses.link}</a> : null}
                </div>
              </article>
            );
          })}
          {linkedPosts.map((post) => {
            const link = safeHttpUrl(post.linkUrl);
            if (!link) return null;
            return (
              <article key={post.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">{post.title || dict.courses.link}</h2>
                <a href={link} className="mt-1 block text-sm text-sky-800" dir="ltr">{link}</a>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "questions" ? (
        <div className="grid gap-4">
          <ActionForm action={askCourseQuestionAction} className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">{dict.courses.ask}</h2>
            <input type="hidden" name="courseId" value={course.id} />
            <Textarea name="body" placeholder={dict.courses.askPlaceholder} required />
            <SubmitButton label={dict.courses.ask} pendingLabel={dict.common.saving} />
          </ActionForm>
          {questions.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{dict.courses.noQuestions}</p> : null}
          {questions.map((question) => (
            <article key={question.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{personName(question.author, locale)} · <Ltr><Timestamp value={question.createdAt} locale={locale} timeZone={appTimeZone()} /></Ltr></p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{question.body}</p>
              <div className="mt-3 grid gap-2">
                {question.answers.map((answer) => (
                  <p key={answer.id} className="rounded-2xl bg-sky-50 px-3 py-2 text-sm">
                    <span className="font-medium">{personName(answer.author, locale)}: </span>
                    {answer.body}
                  </p>
                ))}
              </div>
              <ActionForm action={answerCourseQuestionAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="questionId" value={question.id} />
                <Input name="body" placeholder={dict.courses.answerPlaceholder} required />
                <SubmitButton label={dict.courses.answer} pendingLabel={dict.common.saving} />
              </ActionForm>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "grades" ? (
        <div className="grid gap-4">
          {canGrade ? (
            <ActionForm action={createExamAction} className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">{dict.courses.examTitle}</h2>
              <p className="text-sm text-slate-500">{fill(dict.courses.gradebookReady, { n: activeEnrollments.length })}</p>
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="title" placeholder={dict.courses.postTitle} required />
              <Textarea name="description" placeholder={dict.courses.description} />
              <Input name="examDate" type="datetime-local" required />
              <Input name="maxScore" type="number" min={1} step="0.01" defaultValue={100} />
              <Textarea name="attachments" placeholder={dict.courses.attachments} />
              <SubmitButton label={dict.courses.createExam} pendingLabel={dict.common.saving} />
            </ActionForm>
          ) : null}
          {exams.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{dict.courses.noExams}</p> : null}
          {exams.map((exam) => {
            const grades = new Map(exam.grades.map((grade) => [grade.studentId, grade]));
            const own = grades.get(session.id);
            return (
              <article key={exam.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">{exam.title}</h2>
                <p className="text-sm text-slate-500">
                  <Ltr><Timestamp value={exam.examDate} locale={locale} timeZone={appTimeZone()} /></Ltr>
                  {" · "}
                  {dict.courses.maxScore} <Ltr>{asNumber(exam.maxScore)}</Ltr>
                </p>
                {exam.description ? <p className="mt-2 text-sm">{exam.description}</p> : null}
                {canGrade ? (
                  <ActionForm action={saveGradesAction} className="mt-3 grid gap-2">
                    <h3 className="text-sm font-medium">{dict.courses.gradebook} · <Ltr>{activeEnrollments.length}</Ltr></h3>
                    <input type="hidden" name="examId" value={exam.id} />
                    {activeEnrollments.map((enrollment) => {
                      const grade = grades.get(enrollment.userId);
                      return (
                        <div key={enrollment.userId} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr]">
                          <p className="self-center text-sm">{personName(enrollment.user, locale)}</p>
                          <Input name={`score:${enrollment.userId}`} type="number" min={0} max={asNumber(exam.maxScore)} step="0.01" defaultValue={grade?.score == null ? "" : asNumber(grade.score)} placeholder={dict.courses.score} />
                          <Input name={`feedback:${enrollment.userId}`} defaultValue={grade?.feedback ?? ""} placeholder={dict.courses.feedback} />
                        </div>
                      );
                    })}
                    <SubmitButton label={dict.courses.saveGrades} pendingLabel={dict.common.saving} />
                  </ActionForm>
                ) : (
                  <p className="mt-3 text-sm">
                    {own?.score == null ? dict.courses.notGraded : <>{dict.courses.score}: <Ltr>{asNumber(own?.score)} / {asNumber(exam.maxScore)}</Ltr></>}
                    {own?.feedback ? ` · ${own.feedback}` : ""}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "attendance" && canAttend && attendance ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm md:p-3">
          <AttendanceBoard
            pathname={base}
            hideCourseSelect
            students={activeEnrollments.map((enrollment) => {
              const record = records.get(enrollment.userId);
              const name = splitName(personName(enrollment.user, locale));
              return {
                id: enrollment.userId,
                firstName: name.firstName,
                lastName: name.lastName,
                badge: enrollment.user.hardwareBadgeId,
                status: record?.status ?? null,
                checkIn: record?.checkInTime ? formatTime(record.checkInTime) : null,
                checkOut: record?.checkOutTime ? formatTime(record.checkOutTime) : null,
                minutesLate: record?.minutesLate ?? null,
                totalMinutes: record?.totalMinutes ?? null,
              };
            })}
            courses={[]}
            date={date}
            courseId={course.id}
            officialStart={attendance[0]?.officialStartTime ?? "16:00"}
            graceMinutes={attendance[0]?.lateGraceMinutes ?? 0}
            timeZone={appTimeZone()}
            closure={closure}
            labels={{
              search: dict.attendance.search,
              all: dict.attendance.all,
              unmarked: dict.attendance.unmarked,
              attended: dict.status.ATTENDED,
              late: dict.status.LATE,
              absent: dict.status.ABSENT,
              excused: dict.attendance.excusedShort,
              markAll: dict.attendance.markAll,
              marked: dict.attendance.marked,
              present: dict.attendance.present,
              lateCount: dict.attendance.lateCount,
              absentCount: dict.attendance.absentCount,
              addHours: dict.attendance.addHours,
              checkIn: dict.attendance.checkIn,
              checkOut: dict.attendance.checkOut,
              now: dict.attendance.now,
              officialStart: dict.attendance.officialStart,
              plusTwo: dict.attendance.plusTwo,
              save: dict.attendance.saveTimes,
              clearTimes: dict.attendance.clearTimes,
              lateTag: dict.attendance.lateTag,
              hoursTitle: dict.attendance.hoursTitle,
              close: dict.attendance.close,
              noStudents: dict.attendance.noStudents,
              noMatches: dict.attendance.noMatches,
              saved: dict.common.saved,
              invalid: dict.errors.invalid,
              date: dict.common.date,
              course: dict.attendance.course,
              allStudents: dict.attendance.allStudents,
              student: dict.common.name,
              status: dict.common.status,
              hours: dict.attendance.totalTime,
              previous: dict.attendance.previous,
              today: dict.attendance.today,
              next: dict.attendance.next,
              markOffline: dict.attendance.markOffline,
              clearOffline: dict.attendance.clearOffline,
              weekdayTitle: dict.attendance.weekdayTitle,
              weekdayBody: dict.attendance.weekdayBody,
              offlineTitle: dict.attendance.offlineTitle,
              offlineBody: dict.attendance.offlineBody,
            }}
          />
        </div>
      ) : null}

      {tab === "roster" && canRoster ? (
        <ActionForm action={saveRosterAction} className="grid gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">{dict.courses.manageRoster}</h2>
          <input type="hidden" name="courseId" value={course.id} />
          <fieldset>
            <legend className="mb-2 font-medium">{dict.courses.teachers}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {rosterTeachers.map((teacher) => (
                <label key={teacher.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="teacherIds" value={teacher.id} defaultChecked={teacherIds.has(teacher.id)} />
                  {personName(teacher, locale)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-medium">{dict.courses.students}</legend>
            <div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
              {rosterStudents.map((student) => (
                <label key={student.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="studentIds" value={student.id} defaultChecked={studentIds.has(student.id)} />
                  {personName(student, locale)}
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
    </div>
  );
}
