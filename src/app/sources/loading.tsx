import { AppShell } from "@/components/layout/app-shell";
import { SourcesLoading } from "@/components/sources/sources-loading";

export default function Loading() {
  return (
    <AppShell>
      <SourcesLoading />
    </AppShell>
  );
}
