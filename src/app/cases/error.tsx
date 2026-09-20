"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { AppShell } from "@/components/layout/app-shell";

export default function CasesError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main className="cases-page state-page">
        <section className="state-card">
          <span className="state-mark is-error" aria-hidden="true">!</span>
          <h1>{t("cases.error.title")}</h1>
          <p>{t("cases.error.description")}</p>
          <button className="primary-action" onClick={() => reset()} type="button">
            {t("cases.error.retry")}
          </button>
        </section>
      </main>
    </AppShell>
  );
}
