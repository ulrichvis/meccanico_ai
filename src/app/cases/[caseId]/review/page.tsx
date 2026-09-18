import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { SourceDetail } from "@/components/sources/source-detail";
import { getCaseReviewSource } from "@/sources/source-detail-repository";

export default async function CaseReviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  await connection();
  const { caseId } = await params;
  const source = await getCaseReviewSource(caseId);

  if (!source) notFound();

  return (
    <AppShell>
      <SourceDetail focusedCaseId={caseId} source={source} />
    </AppShell>
  );
}
