-- CreateEnum
CREATE TYPE "DriveKind" AS ENUM ('SHEET', 'DOC', 'FORM_LINK', 'PDF_UPLOAD');

-- CreateEnum
CREATE TYPE "DriveCohort" AS ENUM ('COHORT_2026_2027', 'COHORT_2025_2026', 'GENERAL');

-- CreateEnum
CREATE TYPE "DriveVisibility" AS ENUM ('STAFF', 'SHARED');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "hasBankConfirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "psychometryTrack" TEXT,
ADD COLUMN     "stipendApproval" TEXT,
ADD COLUMN     "volunteeringPlace" TEXT;

-- CreateTable
CREATE TABLE "DriveFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "cohort" "DriveCohort" NOT NULL DEFAULT 'GENERAL',
    "visibility" "DriveVisibility" NOT NULL DEFAULT 'STAFF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "kind" "DriveKind" NOT NULL,
    "cohort" "DriveCohort" NOT NULL DEFAULT 'GENERAL',
    "visibility" "DriveVisibility" NOT NULL DEFAULT 'STAFF',
    "columns" JSONB,
    "rows" JSONB,
    "body" TEXT,
    "linkUrl" TEXT,
    "syncKey" TEXT,
    "studentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveFolder_slug_key" ON "DriveFolder"("slug");

-- CreateIndex
CREATE INDEX "DriveFolder_parentId_idx" ON "DriveFolder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFile_slug_key" ON "DriveFile"("slug");

-- CreateIndex
CREATE INDEX "DriveFile_folderId_idx" ON "DriveFile"("folderId");

-- CreateIndex
CREATE INDEX "DriveFile_studentId_idx" ON "DriveFile"("studentId");

-- CreateIndex
CREATE INDEX "DriveFile_syncKey_idx" ON "DriveFile"("syncKey");

-- CreateIndex
CREATE INDEX "StudentProfile_nationalId_idx" ON "StudentProfile"("nationalId");

-- CreateIndex
CREATE INDEX "StudentProfile_cohort_idx" ON "StudentProfile"("cohort");

-- AddForeignKey
ALTER TABLE "DriveFolder" ADD CONSTRAINT "DriveFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DriveFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFile" ADD CONSTRAINT "DriveFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DriveFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFile" ADD CONSTRAINT "DriveFile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
