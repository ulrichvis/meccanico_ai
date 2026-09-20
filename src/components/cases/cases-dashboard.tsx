"use client";

import Link from "next/link";

import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";
import type { BrowsableCase } from "@/cases/case-browser-repository";
import type { CaseBrowserQuery } from "@/schemas/case-browser-query.schema";

const reviewStatusKeys: Record<string, MessageKey> = {
  UNREVIEWED: "cases.reviewStatus.unreviewed",
  REVIEWED: "cases.reviewStatus.reviewed",
  CORRECTED: "cases.reviewStatus.corrected",
};

function reviewStatusKey(status: string): MessageKey {
  return reviewStatusKeys[status] ?? "cases.reviewStatus.unknown";
}

const lifecycleStatusKeys: Record<string, MessageKey> = {
  ACTIVE: "cases.lifecycleStatus.active",
  ARCHIVED: "cases.lifecycleStatus.archived",
  REJECTED: "cases.lifecycleStatus.rejected",
};

function lifecycleStatusKey(status: string): MessageKey {
  return lifecycleStatusKeys[status] ?? "cases.lifecycleStatus.unknown";
}

function vehicleLabel(vehicle: BrowsableCase["vehicles"][number]): string {
  const identity = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const engine = vehicle.engineCode ?? vehicle.engineDescription;

  return [identity, engine].filter(Boolean).join(" · ");
}

interface CasesDashboardProps {
  cases: BrowsableCase[];
  query: CaseBrowserQuery;
}

export function CasesDashboard({ cases, query }: CasesDashboardProps) {
  const { locale, t } = useLanguage();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const hasCustomFilters =
    query.q.length > 0 || query.review !== "all" || query.status !== "active";

  return (
    <main className="cases-page">
      <section className="cases-heading">
        <div>
          <p className="eyebrow">{t("cases.eyebrow")}</p>
          <h1>{t("cases.title")}</h1>
          <p>{t("cases.description")}</p>
        </div>
        <Link className="secondary-action" href="/sources">
          {t("cases.sourcesAction")}
        </Link>
      </section>

      <form action="/cases" className="case-browser-filters" method="get">
        <label className="case-browser-search-field">
          <span>{t("cases.filters.searchLabel")}</span>
          <input
            defaultValue={query.q}
            maxLength={100}
            name="q"
            placeholder={t("cases.filters.searchPlaceholder")}
            type="search"
          />
        </label>

        <label>
          <span>{t("cases.filters.reviewLabel")}</span>
          <select defaultValue={query.review} name="review">
            <option value="all">{t("cases.filters.allReviewStatuses")}</option>
            <option value="unreviewed">{t("cases.reviewStatus.unreviewed")}</option>
            <option value="reviewed">{t("cases.reviewStatus.reviewed")}</option>
            <option value="corrected">{t("cases.reviewStatus.corrected")}</option>
          </select>
        </label>

        <label>
          <span>{t("cases.filters.lifecycleLabel")}</span>
          <select defaultValue={query.status} name="status">
            <option value="active">{t("cases.lifecycleStatus.active")}</option>
            <option value="rejected">{t("cases.lifecycleStatus.rejected")}</option>
            <option value="archived">{t("cases.lifecycleStatus.archived")}</option>
          </select>
        </label>

        <div className="case-browser-filter-actions">
          <button className="primary-action" type="submit">
            {t("cases.filters.submit")}
          </button>
          {hasCustomFilters ? (
            <Link href="/cases">{t("cases.filters.clear")}</Link>
          ) : null}
        </div>
      </form>

      {cases.length === 0 ? (
        <section className="state-card cases-empty">
          <span className="state-mark" aria-hidden="true">0</span>
          <h2>
            {t(hasCustomFilters ? "cases.noResults.title" : "cases.empty.title")}
          </h2>
          <p>
            {t(
              hasCustomFilters
                ? "cases.noResults.description"
                : "cases.empty.description",
            )}
          </p>
          <Link
            className="primary-action"
            href={hasCustomFilters ? "/cases" : "/sources"}
          >
            {t(hasCustomFilters ? "cases.noResults.action" : "cases.empty.action")}
          </Link>
        </section>
      ) : (
        <section className="cases-panel" aria-labelledby="case-results-title">
          <div className="cases-panel-heading">
            <h2 id="case-results-title">{t("cases.resultsTitle")}</h2>
            <span>{t("cases.count", { count: cases.length })}</span>
          </div>

          <div className="case-browser-list">
            {cases.map((item) => {
              const dtcs = item.dtcs.map((dtc) => dtc.code).join(" · ");
              const vehicles = item.vehicles
                .map(vehicleLabel)
                .filter(Boolean)
                .join(" · ");

              return (
                <article className="case-browser-card" key={item.id}>
                  <div className="case-browser-card-heading">
                    <div>
                      <p className="case-browser-type">
                        {item.caseType ?? t("cases.notAvailable")}
                      </p>
                      <h3>{item.title ?? t("cases.untitled")}</h3>
                    </div>
                    <div className="case-browser-statuses">
                      <span
                        className={`case-lifecycle-status is-${item.status.toLowerCase()}`}
                      >
                        {t(lifecycleStatusKey(item.status))}
                      </span>
                      <span
                        className={`case-review-status is-${item.reviewStatus.toLowerCase()}`}
                      >
                        {t(reviewStatusKey(item.reviewStatus))}
                      </span>
                    </div>
                  </div>

                  {item.complaint ? (
                    <p className="case-browser-complaint">{item.complaint}</p>
                  ) : null}

                  <dl className="case-browser-facts">
                    <div>
                      <dt>{t("cases.fields.dtcs")}</dt>
                      <dd>{dtcs || t("cases.notAvailable")}</dd>
                    </div>
                    <div>
                      <dt>{t("cases.fields.vehicles")}</dt>
                      <dd>{vehicles || t("cases.notAvailable")}</dd>
                    </div>
                    <div>
                      <dt>{t("cases.fields.source")}</dt>
                      <dd>{item.source.originalFilename ?? t("cases.unnamedSource")}</dd>
                    </div>
                    <div>
                      <dt>{t("cases.fields.updatedAt")}</dt>
                      <dd>
                        <time dateTime={item.updatedAt}>
                          {dateFormatter.format(new Date(item.updatedAt))}
                        </time>
                      </dd>
                    </div>
                  </dl>

                  <div className="case-browser-actions">
                    <Link href={`/sources/${item.source.id}`}>
                      {t("cases.actions.viewSource")}
                    </Link>
                    <Link className="primary-action" href={`/cases/${item.id}/review`}>
                      {t("cases.actions.review")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
