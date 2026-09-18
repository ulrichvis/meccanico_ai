"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function CaseReviewError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main className="source-detail-page state-page">
        <section className="state-card">
          <span className="state-mark is-error" aria-hidden="true">!</span>
          <h1>{t("caseReview.error.title")}</h1>
          <p>{t("caseReview.error.description")}</p>
          <button className="primary-action" onClick={reset} type="button">
            {t("caseReview.error.retry")}
          </button>
        </section>
      </main>
    </AppShell>
  );
}
