ALTER TABLE "User" ADD COLUMN "loginPassword" TEXT;

UPDATE "User"
SET "loginPassword" = CASE email
  WHEN 'manager@entilaka.local' THEN 'Manager123!'
  WHEN 'teacher@entilaka.local' THEN 'Teacher123!'
  WHEN 'teacher.ar@entilaka.local' THEN 'Teacher123!'
  WHEN 'finance@entilaka.local' THEN 'Finance123!'
  WHEN 'mentor@entilaka.local' THEN 'Mentor123!'
  WHEN 'demo.adam@entilaka.local' THEN 'Student123!'
  WHEN 'student2@entilaka.local' THEN 'Student123!'
  WHEN 'student3@entilaka.local' THEN 'Student123!'
  WHEN 'student4@entilaka.local' THEN 'Student123!'
  ELSE "loginPassword"
END
WHERE email IN (
  'manager@entilaka.local',
  'teacher@entilaka.local',
  'teacher.ar@entilaka.local',
  'finance@entilaka.local',
  'mentor@entilaka.local',
  'demo.adam@entilaka.local',
  'student2@entilaka.local',
  'student3@entilaka.local',
  'student4@entilaka.local'
);

UPDATE "User" AS u
SET "loginPassword" = p."nationalId"
FROM "StudentProfile" AS p
WHERE p."userId" = u.id
  AND p."nationalId" IS NOT NULL
  AND u."loginPassword" IS NULL;
