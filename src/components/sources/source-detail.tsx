"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";
import type { SourceDetail as SourceDetailData } from "@/sources/source-detail-repository";

const sourceStatusKeys = {
  UPLOADED: "sources.status.uploaded",
  EXTRACTING_TEXT: "sources.status.extractingText",
  TEXT_EXTRACTED: "sources.status.textExtracted",
  PROCESSING: "sources.status.processing",
  PERSISTED: "sources.status.persisted",
  SCHEMA_INVALID: "sources.status.schemaInvalid",
  FAILED: "sources.status.failed",
} as const satisfies Record<string, MessageKey>;

const attemptStatusKeys = {
  PENDING: "sourceDetail.attemptStatus.pending",
  RUNNING: "sourceDetail.attemptStatus.running",
  COMPLETED: "sourceDetail.attemptStatus.completed",
  SCHEMA_INVALID: "sourceDetail.attemptStatus.schemaInvalid",
  FAILED: "sourceDetail.attemptStatus.failed",
} as const satisfies Record<string, MessageKey>;

const qualityKeys = {
  readable: "sourceDetail.quality.readable",
  partial: "sourceDetail.quality.partial",
  unreadable: "sourceDetail.quality.unreadable",
} as const satisfies Record<string, MessageKey>;

const warningKeys = {
  PAGE_PARTIAL: "sourceDetail.warnings.pagePartial",
  PAGE_EMPTY: "sourceDetail.warnings.pageEmpty",
  PAGE_UNREADABLE: "sourceDetail.warnings.pageUnreadable",
  DUPLICATE_PAGE_TEXT: "sourceDetail.warnings.duplicatePage",
  UNICODE_REPLACEMENT: "sourceDetail.warnings.unicodeReplacement",
} as const satisfies Record<string, MessageKey>;

const attemptErrorKeys = {
  ATTEMPT_INTERRUPTED: "sourceDetail.attemptErrors.interrupted",
  OPENAI_RESPONSE_REFUSED: "sourceDetail.attemptErrors.refused",
  OPENAI_RESPONSE_INCOMPLETE: "sourceDetail.attemptErrors.incomplete",
  OPENAI_RESPONSE_INVALID: "sourceDetail.attemptErrors.invalidResponse",
  OPENAI_SCHEMA_INVALID: "sourceDetail.attemptErrors.invalidStructure",
  TEXT_QUALITY_FAILED: "sourceDetail.attemptErrors.qualityFailed",
  SOURCE_FILE_INVALID: "sourceDetail.attemptErrors.fileInvalid",
} as const satisfies Record<string, MessageKey>;

const extractionApiErrorKeys = {
  invalid_source: "sourceDetail.actions.errors.invalidSource",
  source_not_found: "sourceDetail.actions.errors.notFound",
  source_not_eligible: "sourceDetail.actions.errors.notEligible",
  extraction_busy: "sourceDetail.actions.errors.busy",
  extraction_failed: "sourceDetail.actions.errors.failed",
  service_unavailable: "sourceDetail.actions.errors.unavailable",
} as const satisfies Record<string, MessageKey>;

function mappedKey(
  value: string | null,
  keys: Record<string, MessageKey>,
  fallback: MessageKey,
): MessageKey {
  return (value && keys[value]) || fallback;
}

export function SourceDetail({ source }: { source: SourceDetailData }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<MessageKey | null>(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );
  const durationFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const document = source.document;
  const readablePages = document?.pages.filter((page) => page.textQuality === "readable").length ?? 0;
  const partialPages = document?.pages.filter((page) => page.textQuality === "partial").length ?? 0;
  const unreadablePages = document?.pages.filter((page) => page.textQuality === "unreadable").length ?? 0;
  const canExtract = source.status === "UPLOADED" || source.status === "FAILED";

  async function startExtraction() {
    if (!canExtract || pending) return;

    setPending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/sources/${source.id}/extraction`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { code?: string }; status?: string }
        | null;

      if (!response.ok) {
        setActionError(
          mappedKey(
            body?.error?.code ?? null,
            extractionApiErrorKeys,
            "sourceDetail.actions.errors.unavailable",
          ),
        );
        return;
      }

      router.refresh();
    } catch {
      setActionError("sourceDetail.actions.errors.unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="source-detail-page">
      <Link className="source-back-link" href="/sources">
        {t("sourceDetail.back")}
      </Link>

      <section className="source-detail-heading">
        <div>
          <p className="eyebrow">{t("sourceDetail.eyebrow")}</p>
          <h1>{source.originalFilename ?? t("sources.unnamed")}</h1>
          <div className="source-detail-reference">
            <span className={`source-status is-${source.status.toLowerCase()}`}>
              {t(mappedKey(source.status, sourceStatusKeys, "sources.status.unknown"))}
            </span>
            <code>{source.id}</code>
          </div>
        </div>

        {canExtract && (
          <button
            className="primary-action source-extraction-action"
            disabled={pending}
            onClick={startExtraction}
            type="button"
          >
            {pending
              ? t("sourceDetail.actions.extracting")
              : source.status === "FAILED"
                ? t("sourceDetail.actions.retry")
                : t("sourceDetail.actions.extract")}
          </button>
        )}
      </section>

      {actionError && (
        <p className="source-action-error" role="alert">
          {t(actionError)}
        </p>
      )}

      {document ? (
        <>
          <section className="source-summary-panel" aria-labelledby="source-summary-title">
            <div className="source-panel-title">
              <div>
                <p className="eyebrow">{t("sourceDetail.summary.eyebrow")}</p>
                <h2 id="source-summary-title">{document.title ?? t("sourceDetail.summary.untitled")}</h2>
              </div>
              <span className="review-state">{t("sourceDetail.summary.unreviewed")}</span>
            </div>

            <dl className="source-metadata-grid">
              <div><dt>{t("sourceDetail.summary.author")}</dt><dd>{document.author ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.sourceDate")}</dt><dd>{document.sourceDate ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.language")}</dt><dd>{document.language ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.pages")}</dt><dd>{numberFormatter.format(document.pageCount)}</dd></div>
              <div><dt>{t("sourceDetail.summary.characters")}</dt><dd>{numberFormatter.format(source.characterCount)}</dd></div>
              <div><dt>{t("sourceDetail.summary.model")}</dt><dd>{document.model ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.extractedAt")}</dt><dd><time dateTime={document.createdAt}>{dateFormatter.format(new Date(document.createdAt))}</time></dd></div>
              <div><dt>{t("sourceDetail.summary.prompt")}</dt><dd>{document.promptVersion ?? t("sourceDetail.unknown")}</dd></div>
            </dl>

            <div className="quality-summary" aria-label={t("sourceDetail.quality.label")}>
              <span className="is-readable">{t("sourceDetail.quality.count", { count: readablePages, quality: t("sourceDetail.quality.readable") })}</span>
              <span className="is-partial">{t("sourceDetail.quality.count", { count: partialPages, quality: t("sourceDetail.quality.partial") })}</span>
              <span className="is-unreadable">{t("sourceDetail.quality.count", { count: unreadablePages, quality: t("sourceDetail.quality.unreadable") })}</span>
            </div>
          </section>

          {(document.quality?.warnings.length ?? 0) > 0 && (
            <section className="source-detail-panel" aria-labelledby="source-warnings-title">
              <h2 id="source-warnings-title">{t("sourceDetail.warnings.title")}</h2>
              <ul className="source-warning-list">
                {document.quality?.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${warning.pageNumber ?? "document"}-${index}`}>
                    {warning.pageNumber
                      ? t("sourceDetail.warnings.withPage", {
                          message: t(mappedKey(warning.code, warningKeys, "sourceDetail.warnings.unknown")),
                          page: warning.pageNumber,
                        })
                      : t(mappedKey(warning.code, warningKeys, "sourceDetail.warnings.unknown"))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="source-detail-panel" aria-labelledby="source-pages-title">
            <div className="source-panel-title">
              <div>
                <p className="eyebrow">{t("sourceDetail.pages.eyebrow")}</p>
                <h2 id="source-pages-title">{t("sourceDetail.pages.title")}</h2>
              </div>
              <span>{t(document.pages.length === 1 ? "sourceDetail.pages.countOne" : "sourceDetail.pages.countMany", { count: document.pages.length })}</span>
            </div>
            <div className="source-page-list">
              {document.pages.map((page) => (
                <details className="source-page" key={page.pageNumber}>
                  <summary>
                    <strong>{t("sourceDetail.pages.page", { page: page.pageNumber })}</strong>
                    <span className={`page-quality is-${page.textQuality}`}>
                      {t(qualityKeys[page.textQuality])}
                    </span>
                  </summary>
                  {page.uncertainty && <p className="page-uncertainty">{page.uncertainty}</p>}
                  <pre>{page.text || t("sourceDetail.pages.noText")}</pre>
                </details>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="state-card source-awaiting-card">
          <span className="state-mark" aria-hidden="true">PDF</span>
          <h2>{source.status === "FAILED" ? t("sourceDetail.empty.failedTitle") : t("sourceDetail.empty.title")}</h2>
          <p>{source.status === "FAILED" ? t("sourceDetail.empty.failedDescription") : t("sourceDetail.empty.description")}</p>
        </section>
      )}

      <section className="source-detail-panel" aria-labelledby="source-history-title">
        <div className="source-panel-title">
          <div>
            <p className="eyebrow">{t("sourceDetail.history.eyebrow")}</p>
            <h2 id="source-history-title">{t("sourceDetail.history.title")}</h2>
          </div>
          <span>{t(source.extractionJobs.length === 1 ? "sourceDetail.history.countOne" : "sourceDetail.history.countMany", { count: source.extractionJobs.length })}</span>
        </div>

        {source.extractionJobs.length === 0 ? (
          <p className="source-panel-empty">{t("sourceDetail.history.empty")}</p>
        ) : (
          <div className="attempt-list">
            {source.extractionJobs.map((job, index) => (
              <article className="attempt-card" key={job.id}>
                <div className="attempt-heading">
                  <strong>{t("sourceDetail.history.attempt", { number: source.extractionJobs.length - index })}</strong>
                  <span className={`attempt-status is-${job.status.toLowerCase()}`}>
                    {t(mappedKey(job.status, attemptStatusKeys, "sourceDetail.attemptStatus.unknown"))}
                  </span>
                </div>
                <dl>
                  <div><dt>{t("sourceDetail.history.model")}</dt><dd>{job.model ?? t("sourceDetail.unknown")}</dd></div>
                  <div><dt>{t("sourceDetail.history.startedAt")}</dt><dd>{job.startedAt ? dateFormatter.format(new Date(job.startedAt)) : t("sourceDetail.unknown")}</dd></div>
                  <div><dt>{t("sourceDetail.history.duration")}</dt><dd>{job.durationMs === null ? t("sourceDetail.unknown") : t("sourceDetail.history.seconds", { value: durationFormatter.format(job.durationMs / 1000) })}</dd></div>
                  <div><dt>{t("sourceDetail.history.tokens")}</dt><dd>{job.usage ? t("sourceDetail.history.tokenCounts", { input: numberFormatter.format(job.usage.inputTokens), output: numberFormatter.format(job.usage.outputTokens), total: numberFormatter.format(job.usage.totalTokens) }) : t("sourceDetail.unknown")}</dd></div>
                </dl>
                {job.errorCode && (
                  <p className="attempt-error">
                    {t(mappedKey(job.errorCode, attemptErrorKeys, "sourceDetail.attemptErrors.generic"))}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
