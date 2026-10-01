import assert from "node:assert/strict";
import { processUploadedSource } from "../src/upload/process-uploaded-source";

const sourceId = "00000000-0000-4000-8000-000000000001";
const documentId = "00000000-0000-4000-8000-000000000002";

async function scenario(
  responses: Array<{ body: unknown; status?: number } | Error>,
) {
  const calls: string[] = [];
  const stages: string[] = [];
  const request: typeof fetch = async (input, options) => {
    calls.push(String(input));
    assert.equal(options?.method, "POST");
    const response = responses[calls.length - 1];
    assert(response, "Unexpected downstream request");
    if (response instanceof Error) throw response;
    return Response.json(response.body, { status: response.status ?? 200 });
  };
  const result = await processUploadedSource(sourceId, (stage) => stages.push(stage), request);
  return { result, calls, stages };
}

async function main() {
  for (const status of ["completed", "already_processed"]) {
    for (const analysisStatus of ["persisted", "already_persisted"]) {
      const complete = await scenario([
        { body: { status, documentId } },
        { body: { status: analysisStatus, caseCount: 0 } },
      ]);
      assert.deepEqual(complete.result, { success: true, caseCount: 0 });
      assert.deepEqual(complete.stages, ["extracting", "analyzing"]);
      assert.deepEqual(complete.calls, [
        `/api/sources/${sourceId}/extraction`,
        `/api/sources/${sourceId}/automotive-analysis`,
      ]);
    }
  }

  for (const failure of [
    { body: { error: { code: "extraction_failed" } }, status: 502 },
    { body: { error: { code: "extraction_busy" } }, status: 409 },
    { body: { status: "failed" } },
    { body: { status: "completed", documentId: "invalid" } },
    new Error("synthetic_network_failure"),
  ]) {
    const stopped = await scenario([failure]);
    assert.deepEqual(stopped.result, { success: false, stage: "extracting" });
    assert.equal(stopped.calls.length, 1);
    assert.deepEqual(stopped.stages, ["extracting"]);
  }

  for (const failure of [
    { body: { error: { code: "analysis_failed" } }, status: 502 },
    { body: { status: "failed" } },
    { body: { status: "persisted", caseCount: -1 } },
    new Error("synthetic_network_failure"),
  ]) {
    const stopped = await scenario([{ body: { status: "completed", documentId } }, failure]);
    assert.deepEqual(stopped.result, { success: false, stage: "analyzing" });
    assert.equal(stopped.calls.length, 2);
  }

  const independent = await Promise.all([
    scenario([{ body: { status: "failed" } }]),
    scenario([{ body: { status: "completed", documentId } }, { body: { status: "persisted", caseCount: 2 } }]),
  ]);
  assert.equal(independent[0]!.result.success, false);
  assert.deepEqual(independent[1]!.result, { success: true, caseCount: 2 });
  let invalidCalls = 0;
  const invalid = await processUploadedSource("invalid", () => {}, async () => {
    invalidCalls += 1;
    throw new Error("unexpected_request");
  });
  assert.equal(invalid.success, false);
  assert.equal(invalidCalls, 0);
  console.info("Upload processing sequence, persisted success, failure short-circuiting, idempotent responses, boundary validation, zero-case success, and independent files verified with mocked HTTP only.");
}

main().catch(() => {
  console.error("Upload pipeline verification failed.");
  process.exitCode = 1;
});
