"use client";

import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";

const pipelineSteps = ["ingest", "structure", "retrieve"] as const;
const principles = ["evidence", "uncertainty", "sources"] as const;

export function HomeContent() {
  const { t } = useLanguage();

  return (
    <main>
      <section className="hero" id="overview">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1>{t("home.title")}</h1>
          <p className="hero-description">{t("home.description")}</p>
          <Link className="primary-action" href="/upload">
            {t("home.primaryAction")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <aside className="scope-card">
          <p className="scope-label">{t("home.scopeLabel")}</p>
          <h2>{t("home.scopeTitle")}</h2>
          <p>{t("home.scopeDescription")}</p>
          <div className="scope-signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </aside>
      </section>

      <section className="foundation" id="foundation">
        <div className="section-heading">
          <p className="eyebrow">{t("navigation.foundation")}</p>
          <h2>{t("home.pipelineTitle")}</h2>
          <p>{t("home.pipelineDescription")}</p>
        </div>

        <div className="pipeline-grid">
          {pipelineSteps.map((step) => (
            <article className="pipeline-card" key={step}>
              <span>{t(`home.steps.${step}.number`)}</span>
              <h3>{t(`home.steps.${step}.title`)}</h3>
              <p>{t(`home.steps.${step}.description`)}</p>
            </article>
          ))}
        </div>

        <div className="principles-panel">
          <h2>{t("home.principlesTitle")}</h2>
          <div className="principles-grid">
            {principles.map((principle) => (
              <article key={principle}>
                <span aria-hidden="true" />
                <div>
                  <h3>{t(`home.principles.${principle}.title`)}</h3>
                  <p>{t(`home.principles.${principle}.description`)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
