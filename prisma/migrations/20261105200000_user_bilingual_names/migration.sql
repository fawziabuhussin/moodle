ALTER TABLE "User" ADD COLUMN "nameAr" TEXT;
ALTER TABLE "User" ADD COLUMN "nameHe" TEXT;

UPDATE "User" AS u
SET
  "nameAr" = NULLIF(BTRIM(p."nameAr"), ''),
  "nameHe" = COALESCE(NULLIF(BTRIM(p."nameHe"), ''), NULLIF(BTRIM(u."firstName" || ' ' || u."lastName"), ''))
FROM "StudentProfile" AS p
WHERE p."userId" = u."id";

UPDATE "User"
SET "nameHe" = NULLIF(BTRIM("firstName" || ' ' || "lastName"), '')
WHERE "nameHe" IS NULL;
