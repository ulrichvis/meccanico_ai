import { AppShell } from "@/components/layout/app-shell";
import { UploadSuccess } from "@/components/upload/upload-success";

export default async function UploadSuccessPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;

  return (
    <AppShell>
      <UploadSuccess sourceId={sourceId} />
    </AppShell>
  );
}
