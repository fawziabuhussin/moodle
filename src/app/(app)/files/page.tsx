import { notFound } from "next/navigation";
import { FileExplorer, type ExplorerItem } from "@/components/files/explorer";
import { SyncRosterButton } from "@/components/files/sync-button";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { filesCopy } from "@/lib/files-copy";
import { hasAnyPermission, type Permission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

const EDITORS: Permission[] = ["manage_users_and_roles", "manage_attendance", "manage_stipends", "manage_courses"];

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const session = await requireUser();
  const copy = filesCopy(await getLocale());
  const staff = hasAnyPermission(session.permissions, EDITORS);
  const db = getPrisma();
  const [folders, files] = await Promise.all([
    db.driveFolder.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.driveFile.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (folders.length === 0) {
    return (
      <div className="min-w-0">
        <PageHeader title={copy.title} description={copy.subtitle} />
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
    const direct = files.some((file) => file.folderId === id && file.visibility === "SHARED");
    const nested = folders.some((folder) => folder.parentId === id && canSeeFolder(folder.id));
    const allowed = direct || nested;
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

  const items: ExplorerItem[] = [
    ...folders.filter((folder) => canSeeFolder(folder.id)).map((folder) => ({
      kind: "folder" as const,
      slug: folder.slug,
      name: folder.name,
      path: pathOf(folder.id),
      parentSlug: folder.parentId ? byId.get(folder.parentId)?.slug ?? null : null,
      visibility: folder.visibility,
    })),
    ...files.filter((file) => staff || file.visibility === "SHARED").map((file) => ({
      kind: file.kind,
      slug: file.slug,
      name: file.name,
      path: `${pathOf(file.folderId)} / ${file.name}`,
      parentSlug: byId.get(file.folderId)?.slug ?? null,
      visibility: file.visibility,
    })),
  ];

  const requested = (await searchParams).folder;
  const root = folders.find((folder) => folder.slug === "entilaka-jatt") ?? folders.find((folder) => !folder.parentId);
  const current = folders.find((folder) => folder.slug === requested && canSeeFolder(folder.id)) ?? root;
  if (!current) notFound();

  const crumbs: { slug: string; name: string }[] = [];
  let cursor: typeof current | undefined = current;
  while (cursor) {
    crumbs.unshift({ slug: cursor.slug, name: cursor.name });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return (
    <div className="min-w-0">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <FileExplorer items={items} crumbs={crumbs} currentSlug={current.slug} canEdit={staff} copy={copy} />
    </div>
  );
}
