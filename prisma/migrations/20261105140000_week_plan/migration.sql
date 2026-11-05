CREATE TYPE "ScheduleCategory" AS ENUM ('PSYCHOMETRY', 'PYTHON_AI', 'HEBREW_YAEL', 'VOLUNTEERING', 'IDENTITY_LEADERSHIP', 'WORKSHOP', 'FOOD_BREAK', 'EXAM', 'GENERAL');

CREATE TYPE "RecurrenceType" AS ENUM ('WEEKLY', 'BIWEEKLY', 'ONCE');

ALTER TABLE "Notification" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WeekPlanItem" (
    "id" TEXT NOT NULL,
    "seedKey" TEXT,
    "titleHe" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "courseId" TEXT,
    "category" "ScheduleCategory" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "roomOrLocation" TEXT,
    "instructorName" TEXT,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'WEEKLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeekPlanItem_seedKey_key" ON "WeekPlanItem"("seedKey");
CREATE INDEX "WeekPlanItem_dayOfWeek_isActive_idx" ON "WeekPlanItem"("dayOfWeek", "isActive");
CREATE INDEX "WeekPlanItem_courseId_idx" ON "WeekPlanItem"("courseId");

ALTER TABLE "WeekPlanItem" ADD CONSTRAINT "WeekPlanItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeekPlanItem" ADD CONSTRAINT "WeekPlanItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
