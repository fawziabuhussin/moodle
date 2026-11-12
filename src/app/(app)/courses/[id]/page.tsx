import type { DriveKind } from "@prisma/client";
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Link2,
  Megaphone,
  MessageCircle,
  PenLine,
  Pin,
  Plus,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceBoard } from "@/components/attendance/board";
import { CourseEditor } from "@/components/courses/course-editor";
import { courseProgress, courseTheme, EmptyPanel, Initials, PanelTitle } from "@/components/courses/course-theme";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr, Timestamp } from "@/components/ltr";
import { Field, PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
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
import { cn, fullName, safeHttpUrl } from "@/lib/utils";
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

  const { accent, Icon: CourseIcon } = courseTheme(course.code, course.title);
  const progress = courseProgress(course.startDate, course.endDate);
  const span = [course.startDate, course.endDate].filter(Boolean).map((value) => isoDate(value)).join(" – ");
  const zone = appTimeZone();

  return (
    <div className="min-w-0">
      <PageHeader title={course.title} bare />
      <section className="bg-ink relative isolate mb-5 overflow-hidden rounded-[2rem] text-white shadow-[0_24px_60px_-24px_rgb(11_16_32/0.65)]">
        <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div aria-hidden className={cn("absolute -top-28 -start-16 -z-10 size-96 rounded-full blur-3xl", accent.glow)} />
        <div aria-hidden className="absolute -bottom-32 end-1/4 -z-10 size-72 rounded-full bg-orange-500/10 blur-3xl" />
        <CourseIcon aria-hidden strokeWidth={1.1} className="absolute -end-8 -bottom-12 -z-10 size-60 text-white/[0.06] md:size-80" />
        <div className="flex flex-col gap-6 p-5 md:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20", accent.cover)}>
                <CourseIcon className="size-7" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Ltr className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold tracking-wider ring-1 ring-white/15">{course.code}</Ltr>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", course.isActive ? "bg-lime-400/15 text-lime-300 ring-lime-400/30" : "bg-rose-400/15 text-rose-300 ring-rose-400/30")}>
                  <span className={cn("size-1.5 rounded-full", course.isActive ? "bg-lime-400" : "bg-rose-400")} />
                  {course.isActive ? dict.common.active : dict.courses.inactive}
                </span>
              </div>
            </div>
            <h2 className="mt-5 text-2xl leading-tight font-extrabold tracking-tight md:text-4xl">{course.title}</h2>
            {course.description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-slate-300 md:text-base">{course.description}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                {teachers.length ? (
                  <span className="flex -space-x-2">
                    {teachers.slice(0, 3).map((name) => <Initials key={name} name={name} className="size-8 text-[11px] ring-[#0f1730]" />)}
                  </span>
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-white/10"><UserRound className="size-4 text-slate-400" /></span>
                )}
                <span className="min-w-0 leading-tight">
                  <span className="block text-[11px] text-slate-400">{dict.courses.teacherLabel}</span>
                  <span className="block truncate font-semibold">{teachers.length ? teachers.join(" · ") : dict.courses.noTeachers}</span>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-white/10 text-sky-300"><Users className="size-4" /></span>
                <span className="font-semibold">{fill(dict.courses.enrolledCount, { n: activeEnrollments.length })}</span>
              </span>
              {span ? (
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-white/10 text-orange-300"><CalendarRange className="size-4" /></span>
                  <Ltr className="font-semibold">{span}</Ltr>
                </span>
              ) : null}
            </div>
            {progress != null ? (
              <div className="mt-5 flex max-w-md items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="bg-brand-gradient block h-full rounded-full" style={{ width: `${Math.max(progress, 3)}%` }} />
                </span>
                <Ltr className="text-xs font-bold text-slate-300">{progress}%</Ltr>
              </div>
            ) : null}
          </div>
          {staff ? (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canPost ? (
                <Link href={`${base}?tab=announcements#composer`} className="bg-brand-gradient inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgb(26_143_216/0.6)] transition hover:brightness-110">
                  <Megaphone className="size-4 rtl:-scale-x-100" />{dict.courses.publish}
                </Link>
              ) : null}
              {canRoster ? (
                <Link href={`${base}?tab=roster`} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15"><UserPlus className="size-4" />{dict.courses.manageRoster}</Link>
              ) : null}
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
                triggerClassName="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15"
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className="sticky top-[4.5rem] z-20">
        <TabLinks current={tab} tabs={tabs} />
      </div>

      {tab === "announcements" ? (
        <div className="mx-auto grid max-w-4xl gap-4">
          {canPost ? (
            <details id="composer" open={posts.length === 0} className="group scroll-mt-32 rounded-3xl border border-slate-200/80 bg-white shadow-sm open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sm"><PenLine className="size-5" /></span>
                <span className="flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-400 ring-1 ring-slate-200/70 transition-colors group-hover:bg-slate-100">{dict.courses.postBody}…</span>
                <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <ActionForm action={createPostAction} className="grid gap-3 border-t border-slate-100 p-4 md:p-5">
                <input type="hidden" name="courseId" value={course.id} />
                <Input name="title" placeholder={dict.courses.postTitle} className="h-11 text-base font-semibold" />
                <Textarea name="body" placeholder={dict.courses.postBody} required className="min-h-32" />
                <label className="relative block">
                  <Link2 aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input name="linkUrl" placeholder={dict.courses.link} dir="ltr" className="ps-9" />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <label className={CHIP}><input type="checkbox" name="allowComments" defaultChecked className="sr-only" /><MessageCircle className="size-3.5" />{dict.courses.allowComments}</label>
                    <label className={CHIP}><input type="checkbox" name="isPinned" className="sr-only" /><Pin className="size-3.5" />{dict.courses.pin}</label>
                  </div>
                  <SubmitButton label={dict.courses.publish} pendingLabel={dict.common.saving} className="px-6" />
                </div>
              </ActionForm>
            </details>
          ) : null}
          {posts.length === 0 ? <EmptyPanel icon={Megaphone}>{dict.courses.noPosts}</EmptyPanel> : null}
          {posts.map((post) => {
            const link = safeHttpUrl(post.linkUrl);
            const author = personName(post.author, locale);
            return (
              <article key={post.id} className={cn("relative overflow-hidden rounded-3xl border bg-white shadow-sm", post.isPinned ? "border-amber-200" : "border-slate-200/80")}>
                {post.isPinned ? <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300" /> : null}
                <div className="p-4 md:p-5">
                  <header className="flex items-start gap-3">
                    <Initials name={author} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{author}</p>
                      <p className="text-xs text-slate-500"><Timestamp value={post.createdAt} locale={locale} timeZone={zone} /></p>
                    </div>
                    {post.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200"><Pin className="size-3" />{dict.courses.pin}</span> : null}
                    {canPost ? (
                      <ActionForm action={togglePinAction}>
                        <input type="hidden" name="postId" value={post.id} />
                        <SubmitButton label={post.isPinned ? dict.courses.unpin : dict.courses.pin} pendingLabel={dict.common.saving} variant="ghost" size="sm" className="text-slate-500" />
                      </ActionForm>
                    ) : null}
                  </header>
                  {post.title ? <h3 className="mt-4 text-lg font-bold text-slate-900">{post.title}</h3> : null}
                  <p className={cn("text-[15px] leading-relaxed whitespace-pre-wrap text-slate-700", post.title ? "mt-1.5" : "mt-4")}>{post.body}</p>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="group/link mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 transition-colors hover:border-sky-200 hover:bg-sky-50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-sky-600 shadow-xs ring-1 ring-slate-200"><Link2 className="size-4" /></span>
                      <bdi dir="ltr" className="min-w-0 flex-1 truncate text-sm font-medium text-sky-700">{link}</bdi>
                      <ExternalLink className="size-4 shrink-0 text-slate-400 group-hover/link:text-sky-600" />
                    </a>
                  ) : null}
                </div>
                {post.comments.length > 0 || post.allowComments ? (
                  <div className="grid gap-2.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 md:px-5">
                    {post.comments.length > 0 ? (
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MessageCircle className="size-3.5" /><Ltr>{post.comments.length}</Ltr></p>
                    ) : null}
                    {post.comments.map((comment) => {
                      const commenter = personName(comment.author, locale);
                      return (
                        <div key={comment.id} className="flex items-start gap-2.5">
                          <Initials name={commenter} className="size-7 text-[10px]" />
                          <p className="min-w-0 rounded-2xl rounded-ss-md bg-white px-3 py-2 text-sm text-slate-700 shadow-xs ring-1 ring-slate-200/70">
                            <span className="block text-xs font-bold text-slate-900">{commenter}</span>
                            {comment.body}
                          </p>
                        </div>
                      );
                    })}
                    {post.allowComments ? (
                      <ActionForm action={addCommentAction} className="flex items-center gap-2">
                        <input type="hidden" name="postId" value={post.id} />
                        <Input name="body" placeholder={dict.courses.comment} required className="h-10 rounded-full bg-white" />
                        <SubmitButton label={dict.courses.addComment} pendingLabel={dict.common.saving} size="sm" className="h-10 rounded-full px-4" />
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "content" ? (
        <div className="grid gap-3">
          {visibleFiles.length === 0 && linkedPosts.length === 0 ? <EmptyPanel icon={FolderOpen}>{dict.courses.noFiles}</EmptyPanel> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFiles.map((file) => {
              const external = safeHttpUrl(file.linkUrl);
              const kind = FILE_KINDS[file.kind];
              return (
                <article key={file.id} className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm", kind.tone)}><kind.Icon className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-bold text-slate-900">{file.name}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500"><Ltr>{file.kind.replace("_", " ")}</Ltr></p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/files/${file.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800"><Eye className="size-3.5" />{dict.courses.content}</Link>
                    {external ? <a href={external} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><ExternalLink className="size-3.5" />{dict.courses.link}</a> : null}
                  </div>
                </article>
              );
            })}
            {linkedPosts.map((post) => {
              const link = safeHttpUrl(post.linkUrl);
              if (!link) return null;
              return (
                <a key={post.id} href={link} target="_blank" rel="noreferrer" className="group flex items-start gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sm"><Link2 className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-900">{post.title || dict.courses.link}</span>
                    <bdi dir="ltr" className="mt-0.5 block truncate text-xs text-sky-700">{link}</bdi>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "questions" ? (
        <div className="mx-auto grid max-w-4xl gap-4">
          <ActionForm action={askCourseQuestionAction} className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
            <PanelTitle icon={HelpCircle} tone="from-indigo-400 to-indigo-600">{dict.courses.ask}</PanelTitle>
            <input type="hidden" name="courseId" value={course.id} />
            <Textarea name="body" placeholder={dict.courses.askPlaceholder} required />
            <div className="flex justify-end"><SubmitButton label={dict.courses.ask} pendingLabel={dict.common.saving} className="px-6" /></div>
          </ActionForm>
          {questions.length === 0 ? <EmptyPanel icon={HelpCircle}>{dict.courses.noQuestions}</EmptyPanel> : null}
          {questions.map((question) => {
            const asker = personName(question.author, locale);
            const answered = question.answers.length > 0;
            return (
              <article key={question.id} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                <div className="p-4 md:p-5">
                  <header className="flex items-start gap-3">
                    <Initials name={asker} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{asker}</p>
                      <p className="text-xs text-slate-500"><Timestamp value={question.createdAt} locale={locale} timeZone={zone} /></p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", answered ? "bg-lime-50 text-lime-800 ring-lime-200" : "bg-orange-50 text-orange-700 ring-orange-200")}>
                      {answered ? <CheckCircle2 className="size-3.5" /> : <HelpCircle className="size-3.5" />}
                      <Ltr>{question.answers.length}</Ltr>
                    </span>
                  </header>
                  <p className="mt-4 text-[15px] leading-relaxed font-medium whitespace-pre-wrap text-slate-800">{question.body}</p>
                </div>
                <div className="grid gap-2.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 md:px-5">
                  {question.answers.map((answer) => {
                    const responder = personName(answer.author, locale);
                    return (
                      <div key={answer.id} className="flex items-start gap-2.5">
                        <Initials name={responder} className="size-7 text-[10px]" />
                        <p className="min-w-0 rounded-2xl rounded-ss-md border-s-[3px] border-sky-400 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs ring-1 ring-slate-200/70">
                          <span className="block text-xs font-bold text-slate-900">{responder}</span>
                          {answer.body}
                        </p>
                      </div>
                    );
                  })}
                  <ActionForm action={answerCourseQuestionAction} className="flex items-center gap-2">
                    <input type="hidden" name="questionId" value={question.id} />
                    <Input name="body" placeholder={dict.courses.answerPlaceholder} required className="h-10 rounded-full bg-white" />
                    <SubmitButton label={dict.courses.answer} pendingLabel={dict.common.saving} size="sm" className="h-10 rounded-full px-4" />
                  </ActionForm>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "grades" ? (
        <div className="mx-auto grid max-w-4xl gap-4">
          {canGrade ? (
            <details open={exams.length === 0} className="group rounded-3xl border border-slate-200/80 bg-white shadow-sm open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
                <PanelTitle icon={Plus} tone="from-lime-400 to-lime-600">{dict.courses.examTitle}</PanelTitle>
                <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <ActionForm action={createExamAction} className="grid gap-3 border-t border-slate-100 p-4 md:p-5">
                <p className="text-sm text-slate-500">{fill(dict.courses.gradebookReady, { n: activeEnrollments.length })}</p>
                <input type="hidden" name="courseId" value={course.id} />
                <Input name="title" placeholder={dict.courses.postTitle} required className="h-11 text-base font-semibold" />
                <Textarea name="description" placeholder={dict.courses.description} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={dict.courses.examDate}><Input name="examDate" type="datetime-local" required /></Field>
                  <Field label={dict.courses.maxScore}><Input name="maxScore" type="number" min={1} step="0.01" defaultValue={100} /></Field>
                </div>
                <Textarea name="attachments" placeholder={dict.courses.attachments} />
                <div className="flex justify-end"><SubmitButton label={dict.courses.createExam} pendingLabel={dict.common.saving} className="px-6" /></div>
              </ActionForm>
            </details>
          ) : null}
          {exams.length === 0 ? <EmptyPanel icon={ClipboardList}>{dict.courses.noExams}</EmptyPanel> : null}
          {exams.map((exam) => {
            const grades = new Map(exam.grades.map((grade) => [grade.studentId, grade]));
            const own = grades.get(session.id);
            const max = asNumber(exam.maxScore);
            const graded = exam.grades.filter((grade) => grade.score != null);
            const average = graded.length ? graded.reduce((sum, grade) => sum + asNumber(grade.score), 0) / graded.length : null;
            const ownRatio = own?.score == null || !max ? null : Math.min(1, asNumber(own.score) / max);
            return (
              <article key={exam.id} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex flex-wrap items-start gap-3 p-4 md:p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-sm"><ClipboardList className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900">{exam.title}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600"><CalendarRange className="size-3.5" /><Timestamp value={exam.examDate} locale={locale} timeZone={zone} /></span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{dict.courses.maxScore} <Ltr>{max}</Ltr></span>
                      {canGrade && average != null ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 ring-1 ring-sky-100">Ø <Ltr>{Math.round(average * 10) / 10}</Ltr> · <Ltr>{graded.length}/{activeEnrollments.length}</Ltr></span> : null}
                    </div>
                    {exam.description ? <p className="mt-3 text-sm whitespace-pre-line text-slate-600">{exam.description}</p> : null}
                  </div>
                  {!canGrade ? (
                    <div className="w-full rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70 sm:w-56">
                      {ownRatio == null ? (
                        <p className="text-sm font-semibold text-slate-500">{dict.courses.notGraded}</p>
                      ) : (
                        <>
                          <p className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-500">{dict.courses.score}</span>
                            <Ltr className="text-2xl font-extrabold text-slate-900">{asNumber(own?.score)}<span className="text-sm font-semibold text-slate-400"> / {max}</span></Ltr>
                          </p>
                          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200">
                            <span className={cn("block h-full rounded-full", ownRatio >= 0.85 ? "bg-lime-500" : ownRatio >= 0.6 ? "bg-sky-500" : "bg-orange-500")} style={{ width: `${Math.max(ownRatio * 100, 3)}%` }} />
                          </span>
                        </>
                      )}
                      {own?.feedback ? <p className="mt-2 text-xs text-slate-600">{own.feedback}</p> : null}
                    </div>
                  ) : null}
                </div>
                {canGrade ? (
                  <ActionForm action={saveGradesAction} className="border-t border-slate-100 bg-slate-50/60 p-3 md:p-4">
                    <h4 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-slate-700">{dict.courses.gradebook}<Ltr className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">{activeEnrollments.length}</Ltr></h4>
                    <input type="hidden" name="examId" value={exam.id} />
                    <div className="grid gap-1.5">
                      {activeEnrollments.map((enrollment) => {
                        const grade = grades.get(enrollment.userId);
                        const name = personName(enrollment.user, locale);
                        return (
                          <div key={enrollment.userId} className="grid items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200/70 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)]">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800"><Initials name={name} className="size-7 text-[10px]" /><span className="truncate">{name}</span></p>
                            <Input name={`score:${enrollment.userId}`} type="number" min={0} max={max} step="0.01" defaultValue={grade?.score == null ? "" : asNumber(grade.score)} placeholder={dict.courses.score} className="h-9 text-center font-bold" />
                            <Input name={`feedback:${enrollment.userId}`} defaultValue={grade?.feedback ?? ""} placeholder={dict.courses.feedback} className="h-9" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-end"><SubmitButton label={dict.courses.saveGrades} pendingLabel={dict.common.saving} className="px-6" /></div>
                  </ActionForm>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "attendance" && canAttend && attendance ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm md:p-4">
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
        <ActionForm action={saveRosterAction} className="grid gap-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-6">
          <PanelTitle icon={UserPlus} tone="from-orange-400 to-orange-600">{dict.courses.manageRoster}</PanelTitle>
          <input type="hidden" name="courseId" value={course.id} />
          <fieldset>
            <legend className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-700"><GraduationCap className="size-4 text-slate-400" />{dict.courses.teachers}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rosterTeachers.map((teacher) => {
                const name = personName(teacher, locale);
                return (
                  <label key={teacher.id} className={PICK}>
                    <input type="checkbox" name="teacherIds" value={teacher.id} defaultChecked={teacherIds.has(teacher.id)} className="peer size-4 shrink-0" />
                    <Initials name={name} className="size-8 text-[11px]" />
                    <span className="truncate">{name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-700"><Users className="size-4 text-slate-400" />{dict.courses.students}</legend>
            <div className="grid max-h-[28rem] gap-2 overflow-auto rounded-2xl bg-slate-50/70 p-2 ring-1 ring-slate-200/70 sm:grid-cols-2 lg:grid-cols-3">
              {rosterStudents.map((student) => {
                const name = personName(student, locale);
                return (
                  <label key={student.id} className={PICK}>
                    <input type="checkbox" name="studentIds" value={student.id} defaultChecked={studentIds.has(student.id)} className="peer size-4 shrink-0" />
                    <Initials name={name} className="size-8 text-[11px]" />
                    <span className="truncate">{name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field label={dict.courses.emails}>
            <Textarea name="emails" placeholder={dict.courses.enrollHint} dir="ltr" />
          </Field>
          <div className="flex justify-end"><SubmitButton label={dict.courses.saveRoster} pendingLabel={dict.common.saving} className="px-6" /></div>
        </ActionForm>
      ) : null}
    </div>
  );
}

const CHIP =
  "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400";

const PICK =
  "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-900";

const FILE_KINDS: Record<DriveKind, { Icon: LucideIcon; tone: string }> = {
  SHEET: { Icon: FileSpreadsheet, tone: "from-lime-400 to-lime-600" },
  DOC: { Icon: FileText, tone: "from-sky-400 to-sky-600" },
  FORM_LINK: { Icon: ClipboardList, tone: "from-violet-400 to-violet-600" },
  PDF_UPLOAD: { Icon: FileText, tone: "from-rose-400 to-rose-600" },
};
