-- AlterTable
ALTER TABLE "Expense"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "receiptUrl" TEXT,
  ADD COLUMN "recurrenceFrequency" TEXT,
  ADD COLUMN "nextOccurrenceAt" TIMESTAMP(3),
  ADD COLUMN "recurrenceSourceId" TEXT;

-- AlterTable
ALTER TABLE "Chore"
  ADD COLUMN "autoRotate" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurrenceSourceId_fkey"
  FOREIGN KEY ("recurrenceSourceId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
