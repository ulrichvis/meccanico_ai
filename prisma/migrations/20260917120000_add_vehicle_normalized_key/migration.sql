-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "normalized_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_normalized_key_key" ON "vehicles"("normalized_key");
