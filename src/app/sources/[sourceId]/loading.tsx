"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function SourceDetailLoading() {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main
        aria-busy="true"
        aria-live="polite"
        className="source-detail-page"
      >
        <section className="source-detail-heading">
          <div>
            <p className="eyebrow">{t("sourceDetail.eyebrow")}</p>
            <h1>{t("sourceDetail.loading")}</h1>
          </div>
        </section>
        <section
          aria-label={t("sourceDetail.loading")}
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
