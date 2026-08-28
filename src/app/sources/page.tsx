import { connection } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { SourcesDashboard } from "@/components/sources/sources-dashboard";
import { listRecentSources } from "@/sources/source-repository";

export default async function SourcesPage() {
  await connection();
  const sources = await listRecentSources();

  return (
    <AppShell>
      <SourcesDashboard sources={sources} />
    </AppShell>
  );
}
