"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function CasesLoading() {
  const { t } = useLanguage();

  return (
    <main className="cases-page" aria-busy="true" aria-live="polite">
      <section className="cases-heading">
        <div>
          <p className="eyebrow">{t("cases.eyebrow")}</p>
          <h1>{t("cases.title")}</h1>
          <p>{t("cases.loading")}</p>
        </div>
      </section>
      <section className="cases-panel cases-skeleton" aria-label={t("cases.loading")}>
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </section>
    </main>
  );
}
