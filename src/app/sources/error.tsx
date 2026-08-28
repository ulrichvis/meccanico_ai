"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function SourcesError({ retry }: { retry: () => void }) {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main className="sources-page state-page">
        <section className="state-card">
          <span className="state-mark is-error" aria-hidden="true">!</span>
          <h1>{t("sources.error.title")}</h1>
          <p>{t("sources.error.description")}</p>
          <button className="primary-action" onClick={() => retry()} type="button">
            {t("sources.error.retry")}
          </button>
        </section>
      </main>
    </AppShell>
  );
}
