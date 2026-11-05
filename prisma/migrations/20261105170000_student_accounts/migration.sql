ALTER TABLE "StudentProfile" ADD COLUMN "nameHe" TEXT;

DROP INDEX "StudentProfile_nationalId_idx";

CREATE UNIQUE INDEX "StudentProfile_nationalId_key" ON "StudentProfile"("nationalId");
