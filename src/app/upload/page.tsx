import { AppShell } from "@/components/layout/app-shell";
import { PdfUploadForm } from "@/components/upload/pdf-upload-form";
import { env } from "@/lib/env";

export default function UploadPage() {
  return (
    <AppShell>
      <PdfUploadForm
        maximumBatchFiles={env.MAX_UPLOAD_FILES_PER_BATCH}
        maximumUploadSizeMb={env.MAX_UPLOAD_SIZE_MB}
      />
    </AppShell>
  );
}
