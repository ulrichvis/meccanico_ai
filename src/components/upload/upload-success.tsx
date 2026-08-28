"use client";

import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";

export function UploadSuccess({ sourceId }: { sourceId: string }) {
  const { t } = useLanguage();

  return (
    <main className="success-page">
      <section className="success-card">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">{t("upload.success.eyebrow")}</p>
        <h1>{t("upload.success.title")}</h1>
        <p>{t("upload.success.description")}</p>
        <p className="source-reference">
          <span>{t("upload.success.reference")}</span>
          <code>{sourceId}</code>
        </p>
        <Link className="primary-action" href="/upload">
          {t("upload.success.another")}
        </Link>
      </section>
    </main>
  );
}
