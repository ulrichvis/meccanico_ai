import { connection } from "next/server";

import { listCases } from "@/cases/case-browser-repository";
import { CasesDashboard } from "@/components/cases/cases-dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { parseCaseBrowserQuery } from "@/schemas/case-browser-query.schema";

interface CasesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  await connection();
  const query = parseCaseBrowserQuery(await searchParams);
  const cases = await listCases(query);

  return (
    <AppShell>
      <CasesDashboard cases={cases} query={query} />
    </AppShell>
  );
}
