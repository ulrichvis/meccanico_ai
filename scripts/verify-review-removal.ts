import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { getDatabaseClient } = await import("../src/db/client");
  const database = getDatabaseClient();
  const schema = `verification_${randomUUID().replaceAll("-", "")}`;
  const rollback = new Error("verification_rollback");
  let verified = false;

  try {
    await database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await transaction.$executeRawUnsafe(`CREATE TYPE "${schema}"."review_status" AS ENUM ('unreviewed', 'reviewed', 'corrected')`);
      await transaction.$executeRawUnsafe(`CREATE TABLE "${schema}"."cases" (
        id integer PRIMARY KEY, title text, status text, created_at timestamptz,
        review_status "${schema}"."review_status", reviewed_at timestamptz, review_notes text
      )`);
      await transaction.$executeRawUnsafe(`CREATE INDEX "cases_status_review_created_at_idx" ON "${schema}"."cases" (status, review_status, created_at DESC)`);
      await transaction.$executeRawUnsafe(`CREATE TABLE "${schema}"."documents" (id integer PRIMARY KEY, metadata_json jsonb)`);
      await transaction.$executeRawUnsafe(`INSERT INTO "${schema}"."cases" VALUES (1, 'Preserved technical content', 'active', now(), 'unreviewed', NULL, NULL)`);
      await transaction.$executeRawUnsafe(`INSERT INTO "${schema}"."documents" VALUES (1, '{"reviewStatus":"unreviewed","language":"it"}'), (2, NULL)`);

      const sql = readFileSync("prisma/migrations/20261001205043_remove_human_review/migration.sql", "utf8")
        .replaceAll('"public"', `"${schema}"`)
        .replace(/^--.*$/gm, "")
        .replace(/\b(BEGIN|COMMIT);/g, "");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await transaction.$executeRawUnsafe(statement);
      }

      const cases = await transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "${schema}"."cases"`);
      assert.equal(cases.length, 1);
      assert.equal(cases[0]?.title, "Preserved technical content");
      assert(!("review_status" in cases[0]!));
      assert(!("reviewed_at" in cases[0]!));
      assert(!("review_notes" in cases[0]!));
      const documents = await transaction.$queryRawUnsafe<Array<{ metadata_json: unknown }>>(`SELECT metadata_json FROM "${schema}"."documents" ORDER BY id`);
      assert.deepEqual(documents.map((item) => item.metadata_json), [{ language: "it" }, null]);
      const indexes = await transaction.$queryRawUnsafe<Array<{ indexname: string }>>(`SELECT indexname FROM pg_indexes WHERE schemaname = '${schema}'`);
      assert(indexes.some((item) => item.indexname === "cases_status_created_at_idx"));
      assert(!indexes.some((item) => item.indexname === "cases_status_review_created_at_idx"));
      const types = await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = '${schema}' AND t.typname = 'review_status'`);
      assert.equal(types[0]?.count, BigInt(0));
      verified = true;
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await database.$disconnect();
  }
  assert(verified);
  console.info("Review-removal migration verified; temporary schema and fixtures rolled back. Live tables were not modified.");
}

main().catch(() => {
  console.error("Review-removal migration verification failed.");
  process.exitCode = 1;
});
