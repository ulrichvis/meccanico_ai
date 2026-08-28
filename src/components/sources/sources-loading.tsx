"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function SourcesLoading() {
  const { t } = useLanguage();

  return (
    <main className="sources-page" aria-busy="true" aria-live="polite">
      <section className="sources-heading">
        <div>
          <p className="eyebrow">{t("sources.eyebrow")}</p>
          <h1>{t("sources.title")}</h1>
          <p>{t("sources.loading")}</p>
        </div>
      </section>
      <section className="sources-panel sources-skeleton" aria-label={t("sources.loading")}>
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </section>
    </main>
  );
}
