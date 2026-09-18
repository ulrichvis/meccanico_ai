"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CaseReviewForm } from "@/components/cases/case-review-form";
import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";
import type { SourceDetail as SourceDetailData } from "@/sources/source-detail-repository";

const sourceStatusKeys = {
  UPLOADED: "sources.status.uploaded",
  EXTRACTING_TEXT: "sources.status.extractingText",
  TEXT_EXTRACTED: "sources.status.textExtracted",
  PROCESSING: "sources.status.processing",
  PERSISTED: "sources.status.persisted",
  SCHEMA_INVALID: "sources.status.schemaInvalid",
  FAILED: "sources.status.failed",
} as const satisfies Record<string, MessageKey>;

const attemptStatusKeys = {
  PENDING: "sourceDetail.attemptStatus.pending",
  RUNNING: "sourceDetail.attemptStatus.running",
  COMPLETED: "sourceDetail.attemptStatus.completed",
  SCHEMA_INVALID: "sourceDetail.attemptStatus.schemaInvalid",
  FAILED: "sourceDetail.attemptStatus.failed",
} as const satisfies Record<string, MessageKey>;

const qualityKeys = {
  readable: "sourceDetail.quality.readable",
  partial: "sourceDetail.quality.partial",
  unreadable: "sourceDetail.quality.unreadable",
} as const satisfies Record<string, MessageKey>;

const warningKeys = {
  PAGE_PARTIAL: "sourceDetail.warnings.pagePartial",
  PAGE_EMPTY: "sourceDetail.warnings.pageEmpty",
  PAGE_UNREADABLE: "sourceDetail.warnings.pageUnreadable",
  DUPLICATE_PAGE_TEXT: "sourceDetail.warnings.duplicatePage",
  UNICODE_REPLACEMENT: "sourceDetail.warnings.unicodeReplacement",
} as const satisfies Record<string, MessageKey>;

const attemptErrorKeys = {
  ATTEMPT_INTERRUPTED: "sourceDetail.attemptErrors.interrupted",
  OPENAI_RESPONSE_REFUSED: "sourceDetail.attemptErrors.refused",
  OPENAI_RESPONSE_INCOMPLETE: "sourceDetail.attemptErrors.incomplete",
  OPENAI_RESPONSE_INVALID: "sourceDetail.attemptErrors.invalidResponse",
  OPENAI_SCHEMA_INVALID: "sourceDetail.attemptErrors.invalidStructure",
  TEXT_QUALITY_FAILED: "sourceDetail.attemptErrors.qualityFailed",
  SOURCE_FILE_INVALID: "sourceDetail.attemptErrors.fileInvalid",
} as const satisfies Record<string, MessageKey>;

const extractionApiErrorKeys = {
  invalid_source: "sourceDetail.actions.errors.invalidSource",
  source_not_found: "sourceDetail.actions.errors.notFound",
  source_not_eligible: "sourceDetail.actions.errors.notEligible",
  extraction_busy: "sourceDetail.actions.errors.busy",
  extraction_failed: "sourceDetail.actions.errors.failed",
  service_unavailable: "sourceDetail.actions.errors.unavailable",
} as const satisfies Record<string, MessageKey>;

const automotiveAnalysisApiErrorKeys = {
  invalid_source: "sourceDetail.automotiveAnalysis.errors.invalidSource",
  source_not_found: "sourceDetail.automotiveAnalysis.errors.notFound",
  source_not_ready: "sourceDetail.automotiveAnalysis.errors.notReady",
  source_not_eligible: "sourceDetail.automotiveAnalysis.errors.notEligible",
  analysis_busy: "sourceDetail.automotiveAnalysis.errors.busy",
  analysis_failed: "sourceDetail.automotiveAnalysis.errors.failed",
  service_unavailable: "sourceDetail.automotiveAnalysis.errors.unavailable",
} as const satisfies Record<string, MessageKey>;

const caseStatusKeys = {
  ACTIVE: "sourceDetail.knowledge.caseStatus.active",
  REJECTED: "sourceDetail.knowledge.caseStatus.rejected",
  ARCHIVED: "sourceDetail.knowledge.caseStatus.archived",
} as const satisfies Record<string, MessageKey>;

const reviewStatusKeys = {
  UNREVIEWED: "sourceDetail.knowledge.reviewStatus.unreviewed",
  REVIEWED: "sourceDetail.knowledge.reviewStatus.reviewed",
  CORRECTED: "sourceDetail.knowledge.reviewStatus.corrected",
} as const satisfies Record<string, MessageKey>;

const originKeys = {
  EXPLICIT_SOURCE: "sourceDetail.knowledge.origin.explicit",
  AI_INFERENCE: "sourceDetail.knowledge.origin.inference",
  HUMAN_ADDED: "sourceDetail.knowledge.origin.human",
} as const satisfies Record<string, MessageKey>;

const dtcRelationshipKeys = {
  PRIMARY: "sourceDetail.knowledge.dtcRelationship.primary",
  POSSIBLE_CAUSE: "sourceDetail.knowledge.dtcRelationship.possibleCause",
  CONSEQUENCE: "sourceDetail.knowledge.dtcRelationship.consequence",
  ASSOCIATED_FAULT: "sourceDetail.knowledge.dtcRelationship.associatedFault",
  ALTERNATIVE_FAULT: "sourceDetail.knowledge.dtcRelationship.alternativeFault",
  SAME_SYSTEM: "sourceDetail.knowledge.dtcRelationship.sameSystem",
  SECONDARY_CODE: "sourceDetail.knowledge.dtcRelationship.secondaryCode",
  UNCLEAR: "sourceDetail.knowledge.dtcRelationship.unclear",
} as const satisfies Record<string, MessageKey>;

const evidenceTypeKeys = {
  THEORETICAL_POSSIBLE_SOLUTION: "sourceDetail.knowledge.evidenceType.theoretical",
  MANUFACTURER_DOCUMENTATION: "sourceDetail.knowledge.evidenceType.manufacturer",
  TECHNICAL_BULLETIN: "sourceDetail.knowledge.evidenceType.bulletin",
  WORKSHOP_REPORT: "sourceDetail.knowledge.evidenceType.workshop",
  REAL_CASE: "sourceDetail.knowledge.evidenceType.realCase",
  CONFIRMED_REPAIR: "sourceDetail.knowledge.evidenceType.confirmedRepair",
  MULTIPLE_CONFIRMED_CASES: "sourceDetail.knowledge.evidenceType.multipleCases",
  UNCLEAR: "sourceDetail.knowledge.evidenceType.unclear",
} as const satisfies Record<string, MessageKey>;

const relationshipNodeKeys = {
  DTC: "caseReview.relationships.nodeTypes.dtc",
  SYMPTOM: "caseReview.relationships.nodeTypes.symptom",
  CAUSE: "caseReview.relationships.nodeTypes.cause",
  DIAGNOSTIC_CHECK: "caseReview.relationships.nodeTypes.diagnosticCheck",
  SOLUTION: "caseReview.relationships.nodeTypes.solution",
  REPAIR_OUTCOME: "caseReview.relationships.nodeTypes.repairOutcome",
} as const satisfies Record<string, MessageKey>;

function mappedKey(
  value: string | null,
  keys: Record<string, MessageKey>,
  fallback: MessageKey,
): MessageKey {
  return (value && keys[value]) || fallback;
}

export function SourceDetail({
  focusedCaseId,
  source,
}: {
  focusedCaseId?: string;
  source: SourceDetailData;
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [extractionPending, setExtractionPending] = useState(false);
  const [automotiveAnalysisPending, setAutomotiveAnalysisPending] = useState(false);
  const [actionError, setActionError] = useState<MessageKey | null>(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );
  const durationFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const document = source.document;
  const readablePages = document?.pages.filter((page) => page.textQuality === "readable").length ?? 0;
  const partialPages = document?.pages.filter((page) => page.textQuality === "partial").length ?? 0;
  const unreadablePages = document?.pages.filter((page) => page.textQuality === "unreadable").length ?? 0;
  const canExtract =
    source.status === "UPLOADED" ||
    (source.status === "FAILED" && document === null);
  const automotiveCases = focusedCaseId
    ? source.automotiveCases.filter((item) => item.id === focusedCaseId)
    : source.automotiveCases;
  const focusedCase = focusedCaseId ? automotiveCases[0] : undefined;
  const canAnalyzeAutomotive =
    !focusedCaseId &&
    document !== null &&
    automotiveCases.length === 0 &&
    ["TEXT_EXTRACTED", "SCHEMA_INVALID", "FAILED"].includes(source.status);
  const automotiveAnalysisInProgress =
    !focusedCaseId &&
    document !== null &&
    automotiveCases.length === 0 &&
    source.status === "PROCESSING";
  const sourceLanguage = document?.language?.match(/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i)
    ? document.language
    : undefined;

  function originBadge(origin: string, confidence: string | null) {
    const confidenceValue = confidence === null ? null : Number(confidence) * 100;

    return (
      <span className={`knowledge-origin is-${origin.toLowerCase()}`}>
        {t(mappedKey(origin, originKeys, "sourceDetail.knowledge.origin.unknown"))}
        {confidenceValue !== null && Number.isFinite(confidenceValue)
          ? t("sourceDetail.knowledge.origin.confidence", {
              value: numberFormatter.format(confidenceValue),
            })
          : ""}
      </span>
    );
  }

  function booleanValue(value: boolean | null) {
    return t(
      value === null
        ? "sourceDetail.unknown"
        : value
          ? "sourceDetail.knowledge.values.yes"
          : "sourceDetail.knowledge.values.no",
    );
  }

  async function startExtraction() {
    if (!canExtract || extractionPending) return;

    setExtractionPending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/sources/${source.id}/extraction`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { code?: string }; status?: string }
        | null;

      if (!response.ok) {
        setActionError(
          mappedKey(
            body?.error?.code ?? null,
            extractionApiErrorKeys,
            "sourceDetail.actions.errors.unavailable",
          ),
        );
        return;
      }

      router.refresh();
    } catch {
      setActionError("sourceDetail.actions.errors.unavailable");
    } finally {
      setExtractionPending(false);
    }
  }

  async function startAutomotiveAnalysis() {
    if (!canAnalyzeAutomotive || automotiveAnalysisPending) return;

    setAutomotiveAnalysisPending(true);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/sources/${source.id}/automotive-analysis`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: { code?: string }; status?: string }
        | null;

      if (!response.ok) {
        setActionError(
          mappedKey(
            body?.error?.code ?? null,
            automotiveAnalysisApiErrorKeys,
            "sourceDetail.automotiveAnalysis.errors.unavailable",
          ),
        );
        return;
      }

      router.refresh();
    } catch {
      setActionError("sourceDetail.automotiveAnalysis.errors.unavailable");
    } finally {
      setAutomotiveAnalysisPending(false);
    }
  }

  return (
    <main className="source-detail-page">
      <Link
        className="source-back-link"
        href={focusedCaseId ? `/sources/${source.id}` : "/sources"}
      >
        {t(focusedCaseId ? "caseReview.back" : "sourceDetail.back")}
      </Link>

      <section className="source-detail-heading">
        <div>
          <p className="eyebrow">
            {t(focusedCaseId ? "caseReview.eyebrow" : "sourceDetail.eyebrow")}
          </p>
          <h1>
            {focusedCase?.title ?? source.originalFilename ?? t("sources.unnamed")}
          </h1>
          {focusedCaseId && (
            <p className="case-review-source-context">
              {t("caseReview.sourceContext", {
                filename: source.originalFilename ?? t("sources.unnamed"),
              })}
            </p>
          )}
          <div className="source-detail-reference">
            <span className={`source-status is-${(focusedCase?.status ?? source.status).toLowerCase()}`}>
              {focusedCase
                ? t(mappedKey(focusedCase.status, caseStatusKeys, "sourceDetail.knowledge.caseStatus.unknown"))
                : t(mappedKey(source.status, sourceStatusKeys, "sources.status.unknown"))}
            </span>
            {focusedCase && (
              <span className="review-state">
                {t(mappedKey(focusedCase.reviewStatus, reviewStatusKeys, "sourceDetail.knowledge.reviewStatus.unknown"))}
              </span>
            )}
            <code>{focusedCaseId ?? source.id}</code>
          </div>
        </div>

        {!focusedCaseId && (
          <div className="source-heading-actions">
            {canExtract && (
              <button
                className="primary-action source-extraction-action"
                disabled={extractionPending}
                onClick={startExtraction}
                type="button"
              >
                {extractionPending
                  ? t("sourceDetail.actions.extracting")
                  : source.status === "FAILED"
                    ? t("sourceDetail.actions.retry")
                    : t("sourceDetail.actions.extract")}
              </button>
            )}
            {(canAnalyzeAutomotive || automotiveAnalysisInProgress) && (
              <button
                className="primary-action source-extraction-action"
                disabled={automotiveAnalysisPending || automotiveAnalysisInProgress}
                onClick={startAutomotiveAnalysis}
                type="button"
              >
                {automotiveAnalysisPending || automotiveAnalysisInProgress
                  ? t("sourceDetail.automotiveAnalysis.analyzing")
                  : source.status === "SCHEMA_INVALID" || source.status === "FAILED"
                    ? t("sourceDetail.automotiveAnalysis.retry")
                    : t("sourceDetail.automotiveAnalysis.start")}
              </button>
            )}
          </div>
        )}
      </section>

      {actionError && (
        <p className="source-action-error" role="alert">
          {t(actionError)}
        </p>
      )}

      {document ? (
        <>
          <section className="source-summary-panel" aria-labelledby="source-summary-title">
            <div className="source-panel-title">
              <div>
                <p className="eyebrow">{t("sourceDetail.summary.eyebrow")}</p>
                <h2 id="source-summary-title">{document.title ?? t("sourceDetail.summary.untitled")}</h2>
              </div>
              <span className="review-state">{t("sourceDetail.summary.unreviewed")}</span>
            </div>

            <dl className="source-metadata-grid">
              <div><dt>{t("sourceDetail.summary.author")}</dt><dd>{document.author ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.sourceDate")}</dt><dd>{document.sourceDate ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.language")}</dt><dd>{document.language ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.pages")}</dt><dd>{numberFormatter.format(document.pageCount)}</dd></div>
              <div><dt>{t("sourceDetail.summary.characters")}</dt><dd>{numberFormatter.format(source.characterCount)}</dd></div>
              <div><dt>{t("sourceDetail.summary.model")}</dt><dd>{document.model ?? t("sourceDetail.unknown")}</dd></div>
              <div><dt>{t("sourceDetail.summary.extractedAt")}</dt><dd><time dateTime={document.createdAt}>{dateFormatter.format(new Date(document.createdAt))}</time></dd></div>
              <div><dt>{t("sourceDetail.summary.prompt")}</dt><dd>{document.promptVersion ?? t("sourceDetail.unknown")}</dd></div>
            </dl>

            <div className="quality-summary" aria-label={t("sourceDetail.quality.label")}>
              <span className="is-readable">{t("sourceDetail.quality.count", { count: readablePages, quality: t("sourceDetail.quality.readable") })}</span>
              <span className="is-partial">{t("sourceDetail.quality.count", { count: partialPages, quality: t("sourceDetail.quality.partial") })}</span>
              <span className="is-unreadable">{t("sourceDetail.quality.count", { count: unreadablePages, quality: t("sourceDetail.quality.unreadable") })}</span>
            </div>
          </section>

          {(document.quality?.warnings.length ?? 0) > 0 && (
            <section className="source-detail-panel" aria-labelledby="source-warnings-title">
              <h2 id="source-warnings-title">{t("sourceDetail.warnings.title")}</h2>
              <ul className="source-warning-list">
                {document.quality?.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${warning.pageNumber ?? "document"}-${index}`}>
                    {warning.pageNumber
                      ? t("sourceDetail.warnings.withPage", {
                          message: t(mappedKey(warning.code, warningKeys, "sourceDetail.warnings.unknown")),
                          page: warning.pageNumber,
                        })
                      : t(mappedKey(warning.code, warningKeys, "sourceDetail.warnings.unknown"))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {focusedCase && <CaseReviewForm automotiveCase={focusedCase} />}

          {!focusedCaseId && (source.status === "PERSISTED" || automotiveCases.length > 0) && (
            <section className="source-detail-panel knowledge-recap" aria-labelledby="source-knowledge-title">
              <div className="source-panel-title">
                <div>
                  <p className="eyebrow">{t("sourceDetail.knowledge.eyebrow")}</p>
                  <h2 id="source-knowledge-title">{t("sourceDetail.knowledge.title")}</h2>
                </div>
                <span>
                  {t(
                    automotiveCases.length === 1
                      ? "sourceDetail.knowledge.countOne"
                      : "sourceDetail.knowledge.countMany",
                    { count: automotiveCases.length },
                  )}
                </span>
              </div>
              <p className="knowledge-language-note">
                {t("sourceDetail.knowledge.sourceLanguageNotice")}
              </p>

              {automotiveCases.length === 0 ? (
                <div className="knowledge-empty">
                  <strong>{t("sourceDetail.knowledge.empty.title")}</strong>
                  <p>{t("sourceDetail.knowledge.empty.description")}</p>
                </div>
              ) : (
                <div className="knowledge-case-list" lang={sourceLanguage}>
                  {automotiveCases.map((automotiveCase, caseIndex) => (
                    <article className="knowledge-case-shell" key={automotiveCase.id}>
                      {!focusedCaseId && (
                        <div className="knowledge-case-actions">
                          <Link
                            className="secondary-action case-review-link"
                            href={`/cases/${automotiveCase.id}/review`}
                          >
                            {t("caseReview.open")}
                          </Link>
                        </div>
                      )}
                      <details
                        className="knowledge-case"
                        open={automotiveCases.length === 1}
                      >
                      <summary>
                        <div>
                          <span className="knowledge-case-number">
                            {t("sourceDetail.knowledge.caseNumber", { number: caseIndex + 1 })}
                          </span>
                          <strong>
                            {automotiveCase.title ?? t("sourceDetail.knowledge.untitledCase")}
                          </strong>
                        </div>
                        <div className="knowledge-case-badges">
                          <span>{t(mappedKey(automotiveCase.status, caseStatusKeys, "sourceDetail.knowledge.caseStatus.unknown"))}</span>
                          <span>{t(mappedKey(automotiveCase.reviewStatus, reviewStatusKeys, "sourceDetail.knowledge.reviewStatus.unknown"))}</span>
                        </div>
                      </summary>

                      <div className="knowledge-case-content">
                        {(automotiveCase.caseType || automotiveCase.complaint || automotiveCase.problemDescription || automotiveCase.analysisSummary || automotiveCase.reviewNotes) && (
                          <dl className="knowledge-facts">
                            {automotiveCase.caseType && <div><dt>{t("sourceDetail.knowledge.labels.caseType")}</dt><dd>{automotiveCase.caseType}</dd></div>}
                            {automotiveCase.complaint && <div><dt>{t("sourceDetail.knowledge.labels.complaint")}</dt><dd>{automotiveCase.complaint}</dd></div>}
                            {automotiveCase.problemDescription && <div><dt>{t("sourceDetail.knowledge.labels.problem")}</dt><dd>{automotiveCase.problemDescription}</dd></div>}
                            {automotiveCase.analysisSummary && <div><dt>{t("caseReview.analysisSummary")}</dt><dd>{automotiveCase.analysisSummary}</dd></div>}
                            {automotiveCase.reviewNotes && <div><dt>{t("caseReview.reviewNotes")}</dt><dd>{automotiveCase.reviewNotes}</dd></div>}
                          </dl>
                        )}

                        {automotiveCase.vehicles.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.vehicles")}</h3>
                            <div className="knowledge-grid">
                              {automotiveCase.vehicles.map((vehicle) => {
                                const vehicleName = [vehicle.brand, vehicle.model, vehicle.generation].filter(Boolean).join(" ");
                                return (
                                  <article className="knowledge-item" key={vehicle.id}>
                                    <div className="knowledge-item-heading">
                                      <strong>{vehicleName || t("sourceDetail.knowledge.labels.unspecifiedVehicle")}</strong>
                                      {originBadge(vehicle.relationOrigin, vehicle.confidence)}
                                    </div>
                                    <dl>
                                      {(vehicle.yearFrom || vehicle.yearTo) && <div><dt>{t("sourceDetail.knowledge.labels.years")}</dt><dd>{vehicle.yearFrom ?? "…"}–{vehicle.yearTo ?? "…"}</dd></div>}
                                      {vehicle.engineDescription && <div><dt>{t("sourceDetail.knowledge.labels.engine")}</dt><dd>{vehicle.engineDescription}</dd></div>}
                                      {vehicle.engineCode && <div><dt>{t("sourceDetail.knowledge.labels.engineCode")}</dt><dd><code>{vehicle.engineCode}</code></dd></div>}
                                      {vehicle.fuelType && <div><dt>{t("sourceDetail.knowledge.labels.fuel")}</dt><dd>{vehicle.fuelType}</dd></div>}
                                      {vehicle.power && <div><dt>{t("sourceDetail.knowledge.labels.power")}</dt><dd>{vehicle.power}</dd></div>}
                                      {vehicle.transmission && <div><dt>{t("sourceDetail.knowledge.labels.transmission")}</dt><dd>{vehicle.transmission}</dd></div>}
                                      {vehicle.compatibilityNote && <div><dt>{t("sourceDetail.knowledge.labels.compatibility")}</dt><dd>{vehicle.compatibilityNote}</dd></div>}
                                    </dl>
                                  </article>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {automotiveCase.dtcs.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.dtcs")}</h3>
                            <div className="knowledge-grid">
                              {automotiveCase.dtcs.map((dtc) => (
                                <article className="knowledge-item" key={dtc.id}>
                                  <div className="knowledge-item-heading">
                                    <strong><code>{dtc.code}</code></strong>
                                    {originBadge(dtc.relationOrigin, dtc.confidence)}
                                  </div>
                                  <p className="knowledge-item-type">{t(mappedKey(dtc.relationshipType, dtcRelationshipKeys, "sourceDetail.knowledge.dtcRelationship.unknown"))}</p>
                                  {dtc.description && <p>{dtc.description}</p>}
                                </article>
                              ))}
                            </div>
                          </section>
                        )}

                        {(automotiveCase.symptoms.length > 0 || automotiveCase.causes.length > 0 || automotiveCase.components.length > 0) && (
                          <div className="knowledge-category-grid">
                            {automotiveCase.symptoms.length > 0 && (
                              <section className="knowledge-section">
                                <h3>{t("sourceDetail.knowledge.sections.symptoms")}</h3>
                                {automotiveCase.symptoms.map((item) => <article className="knowledge-item" key={item.id}><div className="knowledge-item-heading"><strong>{item.name}</strong>{originBadge(item.relationOrigin, item.confidence)}</div>{item.description && <p>{item.description}</p>}</article>)}
                              </section>
                            )}
                            {automotiveCase.causes.length > 0 && (
                              <section className="knowledge-section">
                                <h3>{t("sourceDetail.knowledge.sections.causes")}</h3>
                                {automotiveCase.causes.map((item) => <article className="knowledge-item" key={item.id}><div className="knowledge-item-heading"><strong>{item.name}</strong>{originBadge(item.relationOrigin, item.confidence)}</div>{item.description && <p>{item.description}</p>}{item.probabilitySource && <p><b>{t("sourceDetail.knowledge.labels.sourceFrequency")}</b> {item.probabilitySource}</p>}</article>)}
                              </section>
                            )}
                            {automotiveCase.components.length > 0 && (
                              <section className="knowledge-section">
                                <h3>{t("sourceDetail.knowledge.sections.components")}</h3>
                                {automotiveCase.components.map((item) => <article className="knowledge-item" key={item.id}><div className="knowledge-item-heading"><strong>{item.name}</strong>{originBadge(item.relationOrigin, item.confidence)}</div>{item.componentType && <p>{item.componentType}</p>}{item.role && <p>{item.role}</p>}</article>)}
                              </section>
                            )}
                          </div>
                        )}

                        {automotiveCase.diagnosticChecks.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.checks")}</h3>
                            <div className="knowledge-stack">
                              {automotiveCase.diagnosticChecks.map((check) => (
                                <article className="knowledge-item" key={check.id}>
                                  <div className="knowledge-item-heading"><strong>{check.description}</strong>{originBadge(check.relationOrigin, check.confidence)}</div>
                                  <dl>
                                    {check.expectedResult && <div><dt>{t("sourceDetail.knowledge.labels.expected")}</dt><dd>{check.expectedResult}</dd></div>}
                                    {check.actualResult && <div><dt>{t("sourceDetail.knowledge.labels.actual")}</dt><dd>{check.actualResult}</dd></div>}
                                    {check.interpretation && <div><dt>{t("sourceDetail.knowledge.labels.interpretation")}</dt><dd>{check.interpretation}</dd></div>}
                                  </dl>
                                  {check.measurements.length > 0 && (
                                    <div className="knowledge-measurements">
                                      {check.measurements.map((measurement) => (
                                        <div key={measurement.id}>
                                          <strong>{measurement.parameter}</strong>
                                          <span>{measurement.valueText ?? [measurement.numericValue, measurement.unit].filter(Boolean).join(" ")}</span>
                                          {measurement.conditions && <small>{measurement.conditions}</small>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </article>
                              ))}
                            </div>
                          </section>
                        )}

                        {automotiveCase.solutions.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.solutions")}</h3>
                            <div className="knowledge-stack">
                              {automotiveCase.solutions.map((solution) => (
                                <article className="knowledge-item" key={solution.id}>
                                  <div className="knowledge-item-heading"><strong>{solution.name}</strong>{originBadge(solution.relationOrigin, solution.confidence)}</div>
                                  {solution.description && <p>{solution.description}</p>}
                                  <dl>
                                    <div><dt>{t("sourceDetail.knowledge.labels.repairConfirmed")}</dt><dd>{booleanValue(solution.repairConfirmed)}</dd></div>
                                    <div><dt>{t("sourceDetail.knowledge.labels.repairSuccessful")}</dt><dd>{booleanValue(solution.repairSuccessful)}</dd></div>
                                    {solution.probabilitySource && <div><dt>{t("sourceDetail.knowledge.labels.sourceFrequency")}</dt><dd>{solution.probabilitySource}</dd></div>}
                                  </dl>
                                  {solution.procedures.length > 0 && <ol className="knowledge-procedure-list">{solution.procedures.map((procedure) => <li key={procedure.id}>{procedure.instruction}</li>)}</ol>}
                                  {solution.outcomes.map((outcome) => (
                                    <div className="knowledge-outcome" key={outcome.id}>
                                      <strong>{t("sourceDetail.knowledge.labels.outcome")}</strong>
                                      <span>{t("sourceDetail.knowledge.labels.attempted")}: {booleanValue(outcome.attempted)}</span>
                                      <span>{t("sourceDetail.knowledge.labels.successful")}: {booleanValue(outcome.successful)}</span>
                                      <span>{t("sourceDetail.knowledge.labels.confirmed")}: {booleanValue(outcome.confirmed)}</span>
                                      {outcome.notes && <p>{outcome.notes}</p>}
                                    </div>
                                  ))}
                                </article>
                              ))}
                            </div>
                          </section>
                        )}

                        {automotiveCase.partsMaterials.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.parts")}</h3>
                            <div className="knowledge-grid">
                              {automotiveCase.partsMaterials.map((item) => <article className="knowledge-item" key={item.id}><div className="knowledge-item-heading"><strong>{item.name}</strong>{originBadge(item.relationOrigin, item.confidence)}</div>{item.partNumber && <p><code>{item.partNumber}</code></p>}{item.manufacturer && <p>{item.manufacturer}</p>}{item.notes && <p>{item.notes}</p>}</article>)}
                            </div>
                          </section>
                        )}

                        {automotiveCase.evidence.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("sourceDetail.knowledge.sections.evidence")}</h3>
                            <div className="knowledge-stack">
                              {automotiveCase.evidence.map((evidence) => (
                                <figure className="knowledge-evidence" key={evidence.id}>
                                  <blockquote>{evidence.excerpt}</blockquote>
                                  <figcaption>
                                    <span>{t(mappedKey(evidence.evidenceType, evidenceTypeKeys, "sourceDetail.knowledge.evidenceType.unknown"))}</span>
                                    {evidence.pageNumber && <span>{t("sourceDetail.knowledge.labels.page", { page: evidence.pageNumber })}</span>}
                                    {originBadge(evidence.relationOrigin, evidence.confidence)}
                                  </figcaption>
                                </figure>
                              ))}
                            </div>
                          </section>
                        )}

                        {automotiveCase.relationships.length > 0 && (
                          <section className="knowledge-section">
                            <h3>{t("caseReview.relationships.title")}</h3>
                            <div className="knowledge-stack">
                              {automotiveCase.relationships.map((relationship) => (
                                <article className="knowledge-item relationship-item" key={relationship.id}>
                                  <div className="knowledge-item-heading">
                                    <strong>{relationship.relationshipType}</strong>
                                    {originBadge(relationship.relationOrigin, relationship.confidence)}
                                  </div>
                                  <div className="relationship-path">
                                    <span>
                                      <small>{t(mappedKey(relationship.fromType, relationshipNodeKeys, "caseReview.relationships.nodeTypes.unknown"))}</small>
                                      {relationship.fromLabel ?? t(mappedKey(relationship.fromType, relationshipNodeKeys, "caseReview.relationships.nodeTypes.unknown"))}
                                    </span>
                                    <span aria-hidden="true">→</span>
                                    <span>
                                      <small>{t(mappedKey(relationship.toType, relationshipNodeKeys, "caseReview.relationships.nodeTypes.unknown"))}</small>
                                      {relationship.toLabel ?? t(mappedKey(relationship.toType, relationshipNodeKeys, "caseReview.relationships.nodeTypes.unknown"))}
                                    </span>
                                  </div>
                                  {relationship.evidence && (
                                    <p className="relationship-evidence">
                                      {relationship.evidence.excerpt}
                                      {relationship.evidence.pageNumber
                                        ? ` · ${t("sourceDetail.knowledge.labels.page", { page: relationship.evidence.pageNumber })}`
                                        : ""}
                                    </p>
                                  )}
                                </article>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="source-detail-panel" aria-labelledby="source-pages-title">
            <div className="source-panel-title">
              <div>
                <p className="eyebrow">{t("sourceDetail.pages.eyebrow")}</p>
                <h2 id="source-pages-title">{t("sourceDetail.pages.title")}</h2>
              </div>
              <span>{t(document.pages.length === 1 ? "sourceDetail.pages.countOne" : "sourceDetail.pages.countMany", { count: document.pages.length })}</span>
            </div>
            <div className="source-page-list">
              {document.pages.map((page) => (
                <details className="source-page" key={page.pageNumber}>
                  <summary>
                    <strong>{t("sourceDetail.pages.page", { page: page.pageNumber })}</strong>
                    <span className={`page-quality is-${page.textQuality}`}>
                      {t(qualityKeys[page.textQuality])}
                    </span>
                  </summary>
                  {page.uncertainty && <p className="page-uncertainty">{page.uncertainty}</p>}
                  <pre>{page.text || t("sourceDetail.pages.noText")}</pre>
                </details>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="state-card source-awaiting-card">
          <span className="state-mark" aria-hidden="true">PDF</span>
          <h2>{source.status === "FAILED" ? t("sourceDetail.empty.failedTitle") : t("sourceDetail.empty.title")}</h2>
          <p>{source.status === "FAILED" ? t("sourceDetail.empty.failedDescription") : t("sourceDetail.empty.description")}</p>
        </section>
      )}

      <section className="source-detail-panel" aria-labelledby="source-history-title">
        <div className="source-panel-title">
          <div>
            <p className="eyebrow">{t("sourceDetail.history.eyebrow")}</p>
            <h2 id="source-history-title">{t("sourceDetail.history.title")}</h2>
          </div>
          <span>{t(source.extractionJobs.length === 1 ? "sourceDetail.history.countOne" : "sourceDetail.history.countMany", { count: source.extractionJobs.length })}</span>
        </div>

        {source.extractionJobs.length === 0 ? (
          <p className="source-panel-empty">{t("sourceDetail.history.empty")}</p>
        ) : (
          <div className="attempt-list">
            {source.extractionJobs.map((job, index) => (
              <article className="attempt-card" key={job.id}>
                <div className="attempt-heading">
                  <strong>{t("sourceDetail.history.attempt", { number: source.extractionJobs.length - index })}</strong>
                  <span className={`attempt-status is-${job.status.toLowerCase()}`}>
                    {t(mappedKey(job.status, attemptStatusKeys, "sourceDetail.attemptStatus.unknown"))}
                  </span>
                </div>
                <dl>
                  <div><dt>{t("sourceDetail.history.model")}</dt><dd>{job.model ?? t("sourceDetail.unknown")}</dd></div>
                  <div><dt>{t("sourceDetail.history.startedAt")}</dt><dd>{job.startedAt ? dateFormatter.format(new Date(job.startedAt)) : t("sourceDetail.unknown")}</dd></div>
                  <div><dt>{t("sourceDetail.history.duration")}</dt><dd>{job.durationMs === null ? t("sourceDetail.unknown") : t("sourceDetail.history.seconds", { value: durationFormatter.format(job.durationMs / 1000) })}</dd></div>
                  <div><dt>{t("sourceDetail.history.tokens")}</dt><dd>{job.usage ? t("sourceDetail.history.tokenCounts", { input: numberFormatter.format(job.usage.inputTokens), output: numberFormatter.format(job.usage.outputTokens), total: numberFormatter.format(job.usage.totalTokens) }) : t("sourceDetail.unknown")}</dd></div>
                </dl>
                {job.errorCode && (
                  <p className="attempt-error">
                    {t(mappedKey(job.errorCode, attemptErrorKeys, "sourceDetail.attemptErrors.generic"))}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
