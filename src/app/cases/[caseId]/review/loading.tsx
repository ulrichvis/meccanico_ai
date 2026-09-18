"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function CaseReviewLoading() {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main aria-busy="true" aria-live="polite" className="source-detail-page">
        <section className="source-detail-heading">
          <div>
            <p className="eyebrow">{t("caseReview.eyebrow")}</p>
            <h1>{t("caseReview.loading")}</h1>
          </div>
        </section>
        <section
          aria-label={t("caseReview.loading")}
          className="sources-panel sources-skeleton"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </section>
      </main>
    </AppShell>
  );
}
