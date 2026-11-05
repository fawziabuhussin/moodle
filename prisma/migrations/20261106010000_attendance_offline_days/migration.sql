CREATE TABLE "AttendanceOfflineDay" (
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceOfflineDay_pkey" PRIMARY KEY ("date")
);
