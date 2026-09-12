-- AlterTable
ALTER TABLE "User" ADD COLUMN "programId" TEXT;

-- CreateIndex
CREATE INDEX "User_programId_idx" ON "User"("programId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
