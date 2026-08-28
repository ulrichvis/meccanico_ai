"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";

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

function formatFileSize(size: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
  }).format(size / 1024 / 1024);
}

export function PdfUploadForm({
  maximumUploadSizeMb,
}: {
  maximumUploadSizeMb: number;
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<UploadErrorCode | null>(null);

  function validateSelectedFile(selectedFile: File): UploadErrorCode | null {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) return "invalid_extension";
    if (selectedFile.type !== "application/pdf") return "invalid_mime_type";
    if (selectedFile.size > maximumUploadSizeMb * 1024 * 1024) return "file_too_large";
    return null;
  }

  function selectFile(selectedFile: File | undefined) {
    if (!selectedFile || pending) return;
    const validationError = validateSelectedFile(selectedFile);
    setErrorCode(validationError);
    setFile(validationError ? null : selectedFile);
    uploadIdRef.current = validationError ? null : crypto.randomUUID();
    setProgress(0);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function submitUpload() {
    if (!file || pending) {
      setErrorCode("file_required");
      return;
    }

    const uploadId = uploadIdRef.current ?? crypto.randomUUID();
    uploadIdRef.current = uploadId;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("uploadId", uploadId);
    const request = new XMLHttpRequest();
    setPending(true);
    setErrorCode(null);
    setProgress(0);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      try {
        const response = JSON.parse(request.responseText) as {
          sourceId?: string;
          error?: { code?: UploadErrorCode };
        };

        if (request.status >= 200 && request.status < 300 && response.sourceId) {
          setProgress(100);
          router.push(`/upload/${response.sourceId}/success`);
          return;
        }

        setErrorCode(response.error?.code ?? "upload_failed");
      } catch {
        setErrorCode("upload_failed");
      }
      setPending(false);
    });
    request.addEventListener("error", () => {
      setErrorCode("upload_failed");
      setPending(false);
    });
    request.open("POST", "/api/sources");
    request.send(formData);
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
            id="pdf-file"
            name="file"
            onChange={handleInputChange}
            ref={inputRef}
            type="file"
          />
          <span className="upload-icon" aria-hidden="true">PDF</span>
          <h2 id="upload-panel-title">{t("upload.dropzone.title")}</h2>
          <p>{t("upload.dropzone.description")}</p>
          <button
            className="secondary-action"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {t("upload.dropzone.browse")}
          </button>
          <small>{t("upload.maximumSize", { size: maximumUploadSizeMb })}</small>
        </div>

        {file && (
          <div className="selected-file">
            <div>
              <strong>{file.name}</strong>
              <span>{formatFileSize(file.size, locale)}</span>
            </div>
            {!pending && (
              <button
                onClick={() => {
                  setFile(null);
                  uploadIdRef.current = null;
                }}
                type="button"
              >
                {t("upload.removeFile")}
              </button>
            )}
          </div>
        )}

        {pending && (
          <div className="upload-progress" aria-live="polite">
            <div>
              <span>{t("upload.progress")}</span>
              <strong>{progress}%</strong>
            </div>
            <progress max="100" value={progress}>{progress}%</progress>
          </div>
        )}

        {errorCode && (
          <p className="upload-error" role="alert">
            {t(uploadErrorKeys[errorCode], { size: maximumUploadSizeMb })}
          </p>
        )}

        <button
          className="primary-action upload-submit"
          disabled={!file || pending}
          onClick={submitUpload}
          type="button"
        >
          {pending ? t("upload.uploading") : t("upload.submit")}
        </button>
      </section>
    </main>
  );
}
