"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { useLanguage } from "@/components/i18n/language-provider";

export default function CaseReviewNotFound() {
  const { t } = useLanguage();

  return (
    <AppShell>
      <main className="source-detail-page state-page">
        <section className="state-card">
          <span className="state-mark is-error" aria-hidden="true">?</span>
          <h1>{t("caseReview.notFound.title")}</h1>
          <p>{t("caseReview.notFound.description")}</p>
          <Link className="primary-action" href="/sources">
            {t("caseReview.notFound.action")}
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
