"use client";

import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";
import type { RecentSource } from "@/sources/source-repository";

const statusKeys = {
  UPLOADED: "sources.status.uploaded",
  EXTRACTING_TEXT: "sources.status.extractingText",
  TEXT_EXTRACTED: "sources.status.textExtracted",
  PROCESSING: "sources.status.processing",
  PERSISTED: "sources.status.persisted",
  SCHEMA_INVALID: "sources.status.schemaInvalid",
  FAILED: "sources.status.failed",
} as const satisfies Record<string, MessageKey>;

const typeKeys = {
  PDF: "sources.type.pdf",
  EMAIL: "sources.type.email",
  WHATSAPP: "sources.type.whatsapp",
  TEXT: "sources.type.text",
  AUDIO: "sources.type.audio",
  DIAGNOSTIC_REPORT: "sources.type.diagnosticReport",
  OTHER: "sources.type.other",
} as const satisfies Record<string, MessageKey>;

function getKey(
  value: string,
  keys: Record<string, MessageKey>,
  fallback: MessageKey,
): MessageKey {
  return keys[value] ?? fallback;
}

export function SourcesDashboard({ sources }: { sources: RecentSource[] }) {
  const { locale, t } = useLanguage();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="sources-page">
      <section className="sources-heading">
        <div>
          <p className="eyebrow">{t("sources.eyebrow")}</p>
          <h1>{t("sources.title")}</h1>
          <p>{t("sources.description")}</p>
        </div>
        <Link className="primary-action" href="/upload">
          {t("sources.uploadAction")}
        </Link>
      </section>

      {sources.length === 0 ? (
        <section className="state-card sources-empty">
          <span className="state-mark" aria-hidden="true">PDF</span>
          <h2>{t("sources.empty.title")}</h2>
          <p>{t("sources.empty.description")}</p>
          <Link className="secondary-action" href="/upload">
            {t("sources.empty.action")}
          </Link>
        </section>
      ) : (
        <section className="sources-panel" aria-labelledby="recent-sources-title">
          <div className="sources-panel-heading">
            <h2 id="recent-sources-title">{t("sources.recentTitle")}</h2>
            <span>{t("sources.count", { count: sources.length })}</span>
          </div>
          <div className="sources-table" role="table" aria-label={t("sources.table.label")}>
            <div className="sources-table-header" role="row">
              <span role="columnheader">{t("sources.table.filename")}</span>
              <span role="columnheader">{t("sources.table.type")}</span>
              <span role="columnheader">{t("sources.table.status")}</span>
              <span role="columnheader">{t("sources.table.uploadedAt")}</span>
            </div>
            {sources.map((source) => (
              <article className="source-row" role="row" key={source.id}>
                <div className="source-name" role="cell">
                  <span className="source-file-mark" aria-hidden="true">PDF</span>
                  <div>
                    <strong>{source.originalFilename ?? t("sources.unnamed")}</strong>
                    <code>{source.id}</code>
                  </div>
                </div>
                <span role="cell" data-label={t("sources.table.type")}>
                  {t(getKey(source.type, typeKeys, "sources.type.other"))}
                </span>
                <span role="cell" data-label={t("sources.table.status")}>
                  <span className={`source-status is-${source.status.toLowerCase()}`}>
                    {t(getKey(source.status, statusKeys, "sources.status.unknown"))}
                  </span>
                </span>
                <time
                  role="cell"
                  data-label={t("sources.table.uploadedAt")}
                  dateTime={source.createdAt}
                >
                  {dateFormatter.format(new Date(source.createdAt))}
                </time>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
