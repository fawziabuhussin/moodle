import { notFound } from "next/navigation";
import { FileExplorer, type ExplorerItem } from "@/components/files/explorer";
import { SyncRosterButton } from "@/components/files/sync-button";
import { PageHeader } from "@/components/page-header";
import { isStudentPortal } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import { grantMatches, type DriveGrant, type DriveViewer } from "@/lib/drive-access";
import { filesCopy } from "@/lib/files-copy";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

const EDITORS: Permission[] = ["manage_users_and_roles", "manage_attendance", "manage_stipends", "manage_courses"];

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const session = await requireUser();
  const copy = filesCopy(await getLocale());
  const staff = hasAnyPermission(session.permissions, EDITORS);
  const db = getPrisma();
  const [folders, files, enrollments] = await Promise.all([
    db.driveFolder.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.driveFile.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    staff ? Promise.resolve([]) : db.courseEnrollment.findMany({ where: { userId: session.id }, select: { courseId: true } }),
  ]);
  const viewer: DriveViewer = { staff, userId: session.id, courseIds: enrollments.map((row) => row.courseId) };
  const portal = isStudentPortal(session);

  if (folders.length === 0) {
    return (
      <div className="min-w-0">
        <PageHeader title={portal ? copy.mine : copy.title} description={portal ? copy.mineSubtitle : copy.subtitle} />
        {staff ? <SyncRosterButton label={copy.sync} pendingLabel={copy.syncing} done={copy.synced} /> : <p className="text-sm text-muted-foreground">{copy.empty}</p>}
      </div>
    );
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visibleFolder = new Map<string, boolean>();
  function canSeeFolder(id: string): boolean {
    if (staff) return true;
    const cached = visibleFolder.get(id);
    if (cached != null) return cached;
    const folder = byId.get(id);
    const self = folder ? grantMatches(folder, viewer) : false;
    const direct = files.some((file) => file.folderId === id && grantMatches(file, viewer));
    const nested = folders.some((child) => child.parentId === id && canSeeFolder(child.id));
    const allowed = self || direct || nested;
    visibleFolder.set(id, allowed);
    return allowed;
  }

  function pathOf(folderId: string) {
    const names: string[] = [];
    let current = byId.get(folderId);
    while (current) {
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(" / ");
  }

  function itemOf(kind: ExplorerItem["kind"], slug: string, name: string, path: string, parentSlug: string | null, grant: DriveGrant): ExplorerItem {
    return {
      kind,
      slug,
      name,
      path,
      parentSlug,
      visibility: grant.visibility,
      access: grant.access,
      allowedUserIds: grant.allowedUserIds,
      allowedCourseIds: grant.allowedCourseIds,
    };
  }

  const items: ExplorerItem[] = [
    ...folders.filter((folder) => canSeeFolder(folder.id)).map((folder) => itemOf(
      "folder",
      folder.slug,
      folder.name,
      pathOf(folder.id),
      folder.parentId ? byId.get(folder.parentId)?.slug ?? null : null,
      folder,
    )),
    ...files.filter((file) => grantMatches(file, viewer)).map((file) => itemOf(
      file.kind,
      file.slug,
      file.name,
      `${pathOf(file.folderId)} / ${file.name}`,
      byId.get(file.folderId)?.slug ?? null,
      file,
    )),
  ];

  const requested = (await searchParams).folder;
  const visibleFolders = folders.filter((folder) => canSeeFolder(folder.id));
  const root = folders.find((folder) => folder.slug === "entilaka-jatt") ?? folders.find((folder) => !folder.parentId);
  const current = folders.find((folder) => folder.slug === requested && canSeeFolder(folder.id))
    ?? (root && canSeeFolder(root.id) ? root : visibleFolders[0]);
  if (!current) {
    return (
      <div className="min-w-0">
        <PageHeader title={portal ? copy.mine : copy.title} description={portal ? copy.mineSubtitle : copy.subtitle} />
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      </div>
    );
  }
  if (requested && requested !== current.slug && !folders.some((folder) => folder.slug === requested)) notFound();

  const crumbs: { slug: string; name: string }[] = [];
  let cursor: typeof current | undefined = current;
  while (cursor && canSeeFolder(cursor.id)) {
    crumbs.unshift({ slug: cursor.slug, name: cursor.name });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  const [people, courses] = staff
    ? await Promise.all([
        db.user.findMany({
          where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
          select: { id: true, firstName: true, lastName: true, hardwareBadgeId: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
        db.course.findMany({ where: { isActive: true }, select: { id: true, code: true, title: true }, orderBy: { title: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="min-w-0">
      <PageHeader title={portal ? copy.mine : copy.title} description={portal ? copy.mineSubtitle : copy.subtitle} />
      <FileExplorer
        items={items}
        crumbs={crumbs}
        currentSlug={current.slug}
        canEdit={staff}
        copy={copy}
        students={people.map((person) => ({ id: person.id, name: fullName(person), badge: person.hardwareBadgeId }))}
        courses={courses}
      />
    </div>
  );
}
