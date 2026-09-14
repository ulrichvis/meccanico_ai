import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { SourceDetail } from "@/components/sources/source-detail";
import { getSourceDetail } from "@/sources/source-detail-repository";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  await connection();
  const { sourceId } = await params;
  const source = await getSourceDetail(sourceId);

  if (!source) notFound();

  return (
    <AppShell>
      <SourceDetail source={source} />
    </AppShell>
  );
}
