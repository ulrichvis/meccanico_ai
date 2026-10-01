-- Deploy the application without review-field reads/writes before applying this migration.
-- Historical extraction artifacts and all technical case data remain unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP INDEX "public"."cases_status_review_created_at_idx";
ALTER TABLE "public"."cases"
  DROP COLUMN "review_status",
  DROP COLUMN "reviewed_at",
  DROP COLUMN "review_notes";
DROP TYPE "public"."review_status";

CREATE INDEX "cases_status_created_at_idx"
  ON "public"."cases" ("status", "created_at" DESC);

UPDATE "public"."documents"
SET "metadata_json" = "metadata_json" - 'reviewStatus'
WHERE "metadata_json" ? 'reviewStatus';

COMMIT;
