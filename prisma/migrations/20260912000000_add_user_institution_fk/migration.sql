-- AlterTable
ALTER TABLE "User" ADD COLUMN "institutionId" TEXT;

-- Backfill institutionId from existing free-text school names (case-insensitive match)
UPDATE "User"
SET "institutionId" = "Institution"."id"
FROM "Institution"
WHERE "User"."institutionId" IS NULL
  AND "User"."school" IS NOT NULL
  AND LOWER(TRIM(BOTH FROM "User"."school")) = LOWER(TRIM(BOTH FROM "Institution"."name"));

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
