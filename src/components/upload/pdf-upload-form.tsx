"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";

const MAXIMUM_CONCURRENT_UPLOADS = 3;

const uploadErrorKeys = {
  file_required: "upload.errors.fileRequired",
  invalid_extension: "upload.errors.invalidExtension",
  invalid_mime_type: "upload.errors.invalidMimeType",
  invalid_pdf: "upload.errors.invalidPdf",
  file_too_large: "upload.errors.fileTooLarge",
  storage_failed: "upload.errors.storageFailed",
  upload_failed: "upload.errors.uploadFailed",
} as const satisfies Record<string, MessageKey>;

type UploadErrorCode = keyof typeof uploadErrorKeys;
type UploadStatus = "queued" | "uploading" | "success" | "error";

interface UploadItem {
  errorCode: UploadErrorCode | null;
  file: File;
  fingerprint: string;
  id: string;
  progress: number;
  sourceId: string | null;
  status: UploadStatus;
}

interface UploadResult {
  sourceId: string | null;
  success: boolean;
}

function formatFileSize(size: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
  }).format(size / 1024 / 1024);
}

function getFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isRetryable(item: UploadItem): boolean {
  return item.status === "queued" || (
    item.status === "error" &&
    (item.errorCode === "storage_failed" || item.errorCode === "upload_failed")
  );
}

export function PdfUploadForm({
  maximumBatchFiles,
  maximumUploadSizeMb,
}: {
  maximumBatchFiles: number;
  maximumUploadSizeMb: number;
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [batchError, setBatchError] = useState<"maximum_files" | "duplicate_file" | null>(null);

  const summary = useMemo(
    () => ({
      failed: items.filter((item) => item.status === "error").length,
      successful: items.filter((item) => item.status === "success").length,
    }),
    [items],
  );
  const uploadableCount = items.filter(isRetryable).length;
  const batchFinished = items.length > 0 && !pending && items.every(
    (item) => item.status === "success" || item.status === "error",
  );

  function validateSelectedFile(file: File): UploadErrorCode | null {
    if (!file.name.toLowerCase().endsWith(".pdf")) return "invalid_extension";
    if (file.type !== "application/pdf") return "invalid_mime_type";
    if (file.size > maximumUploadSizeMb * 1024 * 1024) return "file_too_large";
    return null;
  }

  function addFiles(selectedFiles: File[]) {
    if (pending || selectedFiles.length === 0) return;
    const existing = new Set(items.map((item) => item.fingerprint));
    const availableSlots = Math.max(0, maximumBatchFiles - items.length);
    let duplicateFound = false;
    const newItems = selectedFiles.slice(0, availableSlots).flatMap<UploadItem>((file) => {
      const fingerprint = getFingerprint(file);

      if (existing.has(fingerprint)) {
        duplicateFound = true;
        return [];
      }

      existing.add(fingerprint);
      const errorCode = validateSelectedFile(file);
      return [{
        errorCode,
        file,
        fingerprint,
        id: crypto.randomUUID(),
        progress: 0,
        sourceId: null,
        status: errorCode ? "error" : "queued",
      }];
    });

    setItems((current) => [...current, ...newItems]);
    setBatchError(
      selectedFiles.length > availableSlots
        ? "maximum_files"
        : duplicateFound
          ? "duplicate_file"
          : null,
    );
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function updateItem(itemId: string, update: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => item.id === itemId ? { ...item, ...update } : item),
    );
  }

  function uploadOne(item: UploadItem): Promise<UploadResult> {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.set("file", item.file);
      formData.set("uploadId", item.id);
      const request = new XMLHttpRequest();
      updateItem(item.id, { errorCode: null, progress: 0, status: "uploading" });

      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          updateItem(item.id, {
            progress: Math.round((event.loaded / event.total) * 100),
          });
        }
      });
      request.addEventListener("load", () => {
        try {
          const response = JSON.parse(request.responseText) as {
            sourceId?: string;
            error?: { code?: UploadErrorCode };
          };

          if (request.status >= 200 && request.status < 300 && response.sourceId) {
            updateItem(item.id, {
              progress: 100,
              sourceId: response.sourceId,
              status: "success",
            });
            resolve({ sourceId: response.sourceId, success: true });
            return;
          }

          updateItem(item.id, {
            errorCode: response.error?.code ?? "upload_failed",
            status: "error",
          });
        } catch {
          updateItem(item.id, { errorCode: "upload_failed", status: "error" });
        }
        resolve({ sourceId: null, success: false });
      });
      request.addEventListener("error", () => {
        updateItem(item.id, { errorCode: "upload_failed", status: "error" });
        resolve({ sourceId: null, success: false });
      });
      request.open("POST", "/api/sources");
      request.send(formData);
    });
  }

  async function submitBatch() {
    const targets = items.filter(isRetryable);

    if (targets.length === 0 || pending) return;
    setPending(true);
    setBatchError(null);
    let nextIndex = 0;
    const results: UploadResult[] = [];

    async function worker() {
      while (nextIndex < targets.length) {
        const item = targets[nextIndex];
        nextIndex += 1;
        results.push(await uploadOne(item));
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(MAXIMUM_CONCURRENT_UPLOADS, targets.length) },
        () => worker(),
      ),
    );
    setPending(false);

    if (items.length === 1 && results[0]?.success && results[0].sourceId) {
      router.push(`/upload/${results[0].sourceId}/success`);
    }
  }

  return (
    <main className="upload-page">
      <section className="upload-intro">
        <p className="eyebrow">{t("upload.eyebrow")}</p>
        <h1>{t("upload.title")}</h1>
        <p>{t("upload.description")}</p>
      </section>

      <section className="upload-panel" aria-labelledby="upload-panel-title">
        <div
          className={`drop-zone${dragging ? " is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            accept="application/pdf,.pdf"
            className="sr-only"
            id="pdf-files"
            multiple
            name="files"
            onChange={handleInputChange}
            ref={inputRef}
            type="file"
          />
          <span className="upload-icon" aria-hidden="true">PDF</span>
          <h2 id="upload-panel-title">{t("upload.dropzone.title")}</h2>
          <p>{t("upload.dropzone.description")}</p>
          <button
            className="secondary-action"
            disabled={pending || items.length >= maximumBatchFiles}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {t("upload.dropzone.browse")}
          </button>
          <small>{t("upload.limits", { count: maximumBatchFiles, size: maximumUploadSizeMb })}</small>
        </div>

        {batchError && (
          <p className="upload-error" role="alert">
            {t(
              batchError === "maximum_files"
                ? "upload.errors.maximumFiles"
                : "upload.errors.duplicateFile",
              { count: maximumBatchFiles },
            )}
          </p>
        )}

        {items.length > 0 && (
          <div className="upload-queue">
            <div className="queue-heading">
              <h2>{t("upload.queue.title")}</h2>
              <span>{t("upload.queue.count", { count: items.length, maximum: maximumBatchFiles })}</span>
            </div>
            <div className="file-list">
              {items.map((item) => (
                <article className={`file-item is-${item.status}`} key={item.id}>
                  <div className="file-details">
                    <strong>{item.file.name}</strong>
                    <span>{formatFileSize(item.file.size, locale)}</span>
                  </div>
                  <div className="file-status">
                    <span>{t(`upload.status.${item.status}`)}</span>
                    {item.status === "uploading" && <strong>{item.progress}%</strong>}
                  </div>
                  {item.status === "uploading" && (
                    <progress max="100" value={item.progress}>{item.progress}%</progress>
                  )}
                  {item.errorCode && (
                    <p role="alert">{t(uploadErrorKeys[item.errorCode], { size: maximumUploadSizeMb })}</p>
                  )}
                  {(item.status === "queued" || item.status === "error") && !pending && (
                    <button
                      onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                      type="button"
                    >
                      {t("upload.removeFile")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {batchFinished && (
          <div className="batch-summary" aria-live="polite">
            <h2>{t("upload.summary.title")}</h2>
            <p>{t("upload.summary.result", {
              failed: summary.failed,
              successful: summary.successful,
            })}</p>
          </div>
        )}

        <div className="upload-actions">
          <button
            className="primary-action upload-submit"
            disabled={uploadableCount === 0 || pending}
            onClick={submitBatch}
            type="button"
          >
            {pending ? t("upload.uploading") : t("upload.submitBatch", { count: uploadableCount })}
          </button>
          {batchFinished && (
            <button
              className="secondary-action"
              onClick={() => {
                setItems([]);
                setBatchError(null);
              }}
              type="button"
            >
              {t("upload.summary.anotherBatch")}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
