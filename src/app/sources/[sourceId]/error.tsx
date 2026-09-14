"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function SourceDetailError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main className="source-detail-page state-page">
        <section className="state-card">
          <span className="state-mark is-error" aria-hidden="true">!</span>
          <h1>{t("sourceDetail.error.title")}</h1>
          <p>{t("sourceDetail.error.description")}</p>
          <button className="primary-action" onClick={reset} type="button">
            {t("sourceDetail.error.retry")}
          </button>
        </section>
      </main>
    </AppShell>
  );
}
