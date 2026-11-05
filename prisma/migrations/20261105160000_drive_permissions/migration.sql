CREATE TYPE "DriveVisibility_new" AS ENUM ('MANAGERS_ONLY', 'ALL_STUDENTS', 'SPECIFIC_COURSES', 'SPECIFIC_STUDENTS');
CREATE TYPE "DriveAccess" AS ENUM ('VIEW', 'EDIT');

ALTER TABLE "DriveFolder" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "DriveFile" ALTER COLUMN "visibility" DROP DEFAULT;

ALTER TABLE "DriveFolder" ALTER COLUMN "visibility" TYPE "DriveVisibility_new" USING (
  CASE "visibility"::text WHEN 'SHARED' THEN 'ALL_STUDENTS' ELSE 'MANAGERS_ONLY' END
)::"DriveVisibility_new";
ALTER TABLE "DriveFile" ALTER COLUMN "visibility" TYPE "DriveVisibility_new" USING (
  CASE "visibility"::text WHEN 'SHARED' THEN 'ALL_STUDENTS' ELSE 'MANAGERS_ONLY' END
)::"DriveVisibility_new";

DROP TYPE "DriveVisibility";
ALTER TYPE "DriveVisibility_new" RENAME TO "DriveVisibility";

ALTER TABLE "DriveFolder" ALTER COLUMN "visibility" SET DEFAULT 'MANAGERS_ONLY';
ALTER TABLE "DriveFile" ALTER COLUMN "visibility" SET DEFAULT 'MANAGERS_ONLY';

ALTER TABLE "DriveFolder" ADD COLUMN "access" "DriveAccess" NOT NULL DEFAULT 'VIEW';
ALTER TABLE "DriveFolder" ADD COLUMN "allowedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DriveFolder" ADD COLUMN "allowedCourseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "DriveFile" ADD COLUMN "access" "DriveAccess" NOT NULL DEFAULT 'VIEW';
ALTER TABLE "DriveFile" ADD COLUMN "allowedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DriveFile" ADD COLUMN "allowedCourseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
