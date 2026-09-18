"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { createCaseEditDraft } from "@/cases/case-edit-draft";
import { useLanguage } from "@/components/i18n/language-provider";
import type { MessageKey } from "@/i18n/translator";
import { caseEditSchema, type CaseEditDraft } from "@/schemas/case-edit.schema";
import type { AutomotiveCaseDetail } from "@/sources/source-detail-repository";

type NodeType = CaseEditDraft["relationships"][number]["fromType"];
type SaveState =
  | "idle"
  | "invalid"
  | "saving"
  | "saved"
  | "stale"
  | "conflict"
  | "error";
type LifecycleAction = "review" | "reject" | "archive";
type LifecycleState =
  | "idle"
  | "updating"
  | "reviewed"
  | "rejected"
  | "archived"
  | "stale"
  | "invalid"
  | "error";

const dtcRelationshipKeys = {
  PRIMARY: "sourceDetail.knowledge.dtcRelationship.primary",
  POSSIBLE_CAUSE: "sourceDetail.knowledge.dtcRelationship.possibleCause",
  CONSEQUENCE: "sourceDetail.knowledge.dtcRelationship.consequence",
  ASSOCIATED_FAULT: "sourceDetail.knowledge.dtcRelationship.associatedFault",
  ALTERNATIVE_FAULT: "sourceDetail.knowledge.dtcRelationship.alternativeFault",
  SAME_SYSTEM: "sourceDetail.knowledge.dtcRelationship.sameSystem",
  SECONDARY_CODE: "sourceDetail.knowledge.dtcRelationship.secondaryCode",
  UNCLEAR: "sourceDetail.knowledge.dtcRelationship.unclear",
} as const satisfies Record<CaseEditDraft["dtcs"][number]["relationshipType"], MessageKey>;

const evidenceTypeKeys = {
  THEORETICAL_POSSIBLE_SOLUTION: "sourceDetail.knowledge.evidenceType.theoretical",
  MANUFACTURER_DOCUMENTATION: "sourceDetail.knowledge.evidenceType.manufacturer",
  TECHNICAL_BULLETIN: "sourceDetail.knowledge.evidenceType.bulletin",
  WORKSHOP_REPORT: "sourceDetail.knowledge.evidenceType.workshop",
  REAL_CASE: "sourceDetail.knowledge.evidenceType.realCase",
  CONFIRMED_REPAIR: "sourceDetail.knowledge.evidenceType.confirmedRepair",
  MULTIPLE_CONFIRMED_CASES: "sourceDetail.knowledge.evidenceType.multipleCases",
  UNCLEAR: "sourceDetail.knowledge.evidenceType.unclear",
} as const satisfies Record<CaseEditDraft["evidence"][number]["evidenceType"], MessageKey>;

const nodeTypeKeys = {
  DTC: "caseReview.relationships.nodeTypes.dtc",
  SYMPTOM: "caseReview.relationships.nodeTypes.symptom",
  CAUSE: "caseReview.relationships.nodeTypes.cause",
  DIAGNOSTIC_CHECK: "caseReview.relationships.nodeTypes.diagnosticCheck",
  SOLUTION: "caseReview.relationships.nodeTypes.solution",
  REPAIR_OUTCOME: "caseReview.relationships.nodeTypes.repairOutcome",
} as const satisfies Record<NodeType, MessageKey>;

function newId() {
  return `new-${crypto.randomUUID()}`;
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, currentIndex) => currentIndex === index ? item : current);
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, currentIndex) => currentIndex !== index);
}

function moveAt<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const result = [...items];
  [result[index], result[destination]] = [result[destination], result[index]];
  return result;
}

function nullableText(value: string): string | null {
  return value === "" ? null : value;
}

function nullableInteger(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function triStateValue(value: string): boolean | null {
  return value === "true" ? true : value === "false" ? false : null;
}

function apiErrorCode(result: unknown): unknown {
  return typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null &&
    "code" in result.error
    ? result.error.code
    : null;
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="case-edit-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ItemActions({
  canMoveDown = false,
  canMoveUp = false,
  onMoveDown,
  onMoveUp,
  onRemove,
}: {
  canMoveDown?: boolean;
  canMoveUp?: boolean;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="case-edit-item-actions">
      {onMoveUp && (
        <button disabled={!canMoveUp} onClick={onMoveUp} type="button">
          {t("caseEdit.actions.moveUp")}
        </button>
      )}
      {onMoveDown && (
        <button disabled={!canMoveDown} onClick={onMoveDown} type="button">
          {t("caseEdit.actions.moveDown")}
        </button>
      )}
      <button className="is-danger" onClick={onRemove} type="button">
        {t("caseEdit.actions.remove")}
      </button>
    </div>
  );
}

function Section({
  addDisabled = false,
  children,
  count,
  onAdd,
  title,
}: {
  addDisabled?: boolean;
  children: ReactNode;
  count: number;
  onAdd: () => void;
  title: string;
}) {
  const { t } = useLanguage();

  return (
    <details className="case-edit-section" open={count > 0}>
      <summary>
        <strong>{title}</strong>
        <span>{count}</span>
      </summary>
      <div className="case-edit-section-content">
        {children}
        <button
          className="case-edit-add"
          disabled={addDisabled}
          onClick={onAdd}
          type="button"
        >
          {t("caseEdit.actions.add")}
        </button>
      </div>
    </details>
  );
}

export function CaseReviewForm({
  automotiveCase,
}: {
  automotiveCase: AutomotiveCaseDetail;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [draft, setDraft] = useState(() => createCaseEditDraft(automotiveCase));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [caseStatus, setCaseStatus] = useState(automotiveCase.status);
  const [reviewStatus, setReviewStatus] = useState(automotiveCase.reviewStatus);
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>("idle");
  const nodeOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; type: NodeType }> = [];
    draft.dtcs.forEach((item) => options.push({ id: item.nodeId, label: item.code, type: "DTC" }));
    draft.symptoms.forEach((item) => options.push({ id: item.nodeId, label: item.name, type: "SYMPTOM" }));
    draft.causes.forEach((item) => options.push({ id: item.nodeId, label: item.name, type: "CAUSE" }));
    draft.diagnosticChecks.forEach((item) => options.push({ id: item.id, label: item.description, type: "DIAGNOSTIC_CHECK" }));
    draft.solutions.forEach((item) => {
      options.push({ id: item.nodeId, label: item.name, type: "SOLUTION" });
      item.outcomes.forEach((outcome) => options.push({
        id: outcome.id,
        label: outcome.notes ?? t("caseEdit.labels.unnamedOutcome"),
        type: "REPAIR_OUTCOME",
      }));
    });
    return options;
  }, [draft, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;

    const parsed = caseEditSchema.safeParse(draft);
    if (!parsed.success) {
      setSaveState("invalid");
      return;
    }

    setSaveState("saving");
    try {
      const response = await fetch(`/api/cases/${draft.caseId}`, {
        body: JSON.stringify(parsed.data),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const code = apiErrorCode(result);
        setSaveState(
          code === "stale_edit"
            ? "stale"
            : code === "shared_reference_conflict"
              ? "conflict"
              : code === "invalid_payload"
                ? "invalid"
                : "error",
        );
        return;
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("updatedAt" in result) ||
        typeof result.updatedAt !== "string" ||
        !("reviewStatus" in result) ||
        typeof result.reviewStatus !== "string"
      ) {
        setSaveState("error");
        return;
      }

      const savedUpdatedAt = result.updatedAt;
      setDraft((current) => ({ ...current, updatedAt: savedUpdatedAt }));
      setReviewStatus(result.reviewStatus);
      setSaveState("saved");
      router.refresh();
    } catch {
      setSaveState("error");
    }
  }

  async function updateLifecycle(action: LifecycleAction) {
    if (saveState === "saving" || lifecycleState === "updating") return;
    if (
      (action === "reject" || action === "archive") &&
      !window.confirm(t(`caseEdit.lifecycle.confirm.${action}` as MessageKey))
    ) {
      return;
    }

    setLifecycleState("updating");
    try {
      const response = await fetch(`/api/cases/${draft.caseId}`, {
        body: JSON.stringify({
          action,
          caseId: draft.caseId,
          updatedAt: draft.updatedAt,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = apiErrorCode(result);
        setLifecycleState(
          code === "stale_edit"
            ? "stale"
            : code === "invalid_payload" || code === "invalid_transition"
              ? "invalid"
              : "error",
        );
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("updatedAt" in result) ||
        typeof result.updatedAt !== "string" ||
        !("reviewStatus" in result) ||
        typeof result.reviewStatus !== "string" ||
        !("status" in result) ||
        typeof result.status !== "string"
      ) {
        setLifecycleState("error");
        return;
      }

      const updatedAt = result.updatedAt;
      setDraft((current) => ({ ...current, updatedAt }));
      setCaseStatus(result.status);
      setReviewStatus(result.reviewStatus);
      setLifecycleState(
        action === "review"
          ? "reviewed"
          : action === "reject"
            ? "rejected"
            : "archived",
      );
      router.refresh();
    } catch {
      setLifecycleState("error");
    }
  }

  return (
    <form className="case-edit-form" onSubmit={submit}>
      <div className="case-edit-intro">
        <div>
          <p className="eyebrow">{t("caseEdit.eyebrow")}</p>
          <h2>{t("caseEdit.title")}</h2>
          <p>{t("caseEdit.description")}</p>
        </div>
        <button className="primary-action" disabled={saveState === "saving"} type="submit">
          {t(saveState === "saving" ? "caseEdit.actions.saving" : "caseEdit.actions.save")}
        </button>
      </div>

      {saveState !== "idle" && (
        <p className={`case-edit-validation is-${saveState}`} role="status">
          {t(`caseEdit.validation.${saveState}` as MessageKey)}
        </p>
      )}

      <section className="case-lifecycle-panel">
        <div>
          <h3>{t("caseEdit.lifecycle.title")}</h3>
          <p>{t("caseEdit.lifecycle.description")}</p>
        </div>
        <div className="case-lifecycle-actions">
          {reviewStatus === "UNREVIEWED" && (
            <button
              disabled={saveState === "saving" || lifecycleState === "updating"}
              onClick={() => updateLifecycle("review")}
              type="button"
            >
              {t("caseEdit.lifecycle.actions.review")}
            </button>
          )}
          {caseStatus === "ACTIVE" && (
            <>
              <button
                className="is-danger"
                disabled={saveState === "saving" || lifecycleState === "updating"}
                onClick={() => updateLifecycle("reject")}
                type="button"
              >
                {t("caseEdit.lifecycle.actions.reject")}
              </button>
              <button
                disabled={saveState === "saving" || lifecycleState === "updating"}
                onClick={() => updateLifecycle("archive")}
                type="button"
              >
                {t("caseEdit.lifecycle.actions.archive")}
              </button>
            </>
          )}
        </div>
        {lifecycleState !== "idle" && (
          <p
            className={`case-edit-validation is-${lifecycleState}`}
            role="status"
          >
            {t(`caseEdit.lifecycle.feedback.${lifecycleState}` as MessageKey)}
          </p>
        )}
      </section>

      <section className="case-edit-metadata">
        <h3>{t("caseEdit.sections.metadata")}</h3>
        <div className="case-edit-grid">
          <Field label={t("caseEdit.labels.title")}>
            <input value={draft.title ?? ""} onChange={(event) => setDraft((current) => ({ ...current, title: nullableText(event.target.value) }))} />
          </Field>
          <Field label={t("sourceDetail.knowledge.labels.caseType")}>
            <input value={draft.caseType ?? ""} onChange={(event) => setDraft((current) => ({ ...current, caseType: nullableText(event.target.value) }))} />
          </Field>
          <Field label={t("sourceDetail.knowledge.labels.complaint")}>
            <textarea value={draft.complaint ?? ""} onChange={(event) => setDraft((current) => ({ ...current, complaint: nullableText(event.target.value) }))} />
          </Field>
          <Field label={t("sourceDetail.knowledge.labels.problem")}>
            <textarea value={draft.problemDescription ?? ""} onChange={(event) => setDraft((current) => ({ ...current, problemDescription: nullableText(event.target.value) }))} />
          </Field>
          <Field label={t("caseReview.analysisSummary")}>
            <textarea value={draft.analysisSummary ?? ""} onChange={(event) => setDraft((current) => ({ ...current, analysisSummary: nullableText(event.target.value) }))} />
          </Field>
          <Field label={t("caseReview.reviewNotes")}>
            <textarea value={draft.reviewNotes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, reviewNotes: nullableText(event.target.value) }))} />
          </Field>
        </div>
      </section>

      <div className="case-edit-sections">
        <Section count={draft.vehicles.length} onAdd={() => setDraft((current) => ({ ...current, vehicles: [...current.vehicles, { id: newId(), brand: null, model: null, generation: null, yearFrom: null, yearTo: null, engineDescription: null, engineCode: null, fuelType: null, power: null, transmission: null, compatibilityNote: null }] }))} title={t("sourceDetail.knowledge.sections.vehicles")}>
          {draft.vehicles.map((item, index) => (
            <article className="case-edit-item" key={item.id}>
              <ItemActions onRemove={() => setDraft((current) => ({ ...current, vehicles: removeAt(current.vehicles, index) }))} />
              <div className="case-edit-grid">
                {(["brand", "model", "generation", "engineDescription", "engineCode", "fuelType", "power", "transmission", "compatibilityNote"] as const).map((field) => (
                  <Field key={field} label={t(`caseEdit.labels.${field}` as MessageKey)}>
                    <input value={item[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, vehicles: replaceAt(current.vehicles, index, { ...current.vehicles[index], [field]: nullableText(event.target.value) }) }))} />
                  </Field>
                ))}
                <Field label={t("caseEdit.labels.yearFrom")}><input inputMode="numeric" type="number" value={item.yearFrom ?? ""} onChange={(event) => setDraft((current) => ({ ...current, vehicles: replaceAt(current.vehicles, index, { ...current.vehicles[index], yearFrom: nullableInteger(event.target.value) }) }))} /></Field>
                <Field label={t("caseEdit.labels.yearTo")}><input inputMode="numeric" type="number" value={item.yearTo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, vehicles: replaceAt(current.vehicles, index, { ...current.vehicles[index], yearTo: nullableInteger(event.target.value) }) }))} /></Field>
              </div>
            </article>
          ))}
        </Section>

        <Section count={draft.dtcs.length} onAdd={() => { const id = newId(); setDraft((current) => ({ ...current, dtcs: [...current.dtcs, { id, nodeId: id, code: "", description: null, isPrimary: false, relationshipType: "UNCLEAR" }] })); }} title={t("sourceDetail.knowledge.sections.dtcs")}>
          {draft.dtcs.map((item, index) => (
            <article className="case-edit-item" key={item.id}>
              <ItemActions onRemove={() => setDraft((current) => ({ ...current, dtcs: removeAt(current.dtcs, index) }))} />
              <div className="case-edit-grid">
                <Field label={t("caseEdit.labels.dtcCode")}><input required value={item.code} onChange={(event) => setDraft((current) => ({ ...current, dtcs: replaceAt(current.dtcs, index, { ...current.dtcs[index], code: event.target.value }) }))} /></Field>
                <Field label={t("caseEdit.labels.relationshipType")}><select value={item.relationshipType} onChange={(event) => setDraft((current) => ({ ...current, dtcs: replaceAt(current.dtcs, index, { ...current.dtcs[index], relationshipType: event.target.value as typeof item.relationshipType }) }))}>{Object.entries(dtcRelationshipKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></Field>
                <Field label={t("caseEdit.labels.description")}><textarea value={item.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, dtcs: replaceAt(current.dtcs, index, { ...current.dtcs[index], description: nullableText(event.target.value) }) }))} /></Field>
                <label className="case-edit-checkbox"><input checked={item.isPrimary} onChange={(event) => setDraft((current) => ({ ...current, dtcs: current.dtcs.map((dtc, dtcIndex) => ({ ...dtc, isPrimary: dtcIndex === index ? event.target.checked : event.target.checked ? false : dtc.isPrimary, relationshipType: dtcIndex === index ? (event.target.checked ? "PRIMARY" : "UNCLEAR") : event.target.checked && dtc.isPrimary ? "UNCLEAR" : dtc.relationshipType })) }))} type="checkbox" />{t("caseEdit.labels.primaryDtc")}</label>
              </div>
            </article>
          ))}
        </Section>

        <Section count={draft.symptoms.length} onAdd={() => { const id = newId(); setDraft((current) => ({ ...current, symptoms: [...current.symptoms, { id, nodeId: id, name: "", description: null }] })); }} title={t("sourceDetail.knowledge.sections.symptoms")}>
          {draft.symptoms.map((item, index) => (
            <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, symptoms: removeAt(current.symptoms, index) }))} /><div className="case-edit-grid"><Field label={t("caseEdit.labels.name")}><input required value={item.name} onChange={(event) => setDraft((current) => ({ ...current, symptoms: replaceAt(current.symptoms, index, { ...current.symptoms[index], name: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.description")}><textarea value={item.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, symptoms: replaceAt(current.symptoms, index, { ...current.symptoms[index], description: nullableText(event.target.value) }) }))} /></Field></div></article>
          ))}
        </Section>

        <Section count={draft.causes.length} onAdd={() => { const id = newId(); setDraft((current) => ({ ...current, causes: [...current.causes, { id, nodeId: id, name: "", description: null, probabilitySource: null }] })); }} title={t("sourceDetail.knowledge.sections.causes")}>
          {draft.causes.map((item, index) => (
            <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, causes: removeAt(current.causes, index) }))} /><div className="case-edit-grid"><Field label={t("caseEdit.labels.name")}><input required value={item.name} onChange={(event) => setDraft((current) => ({ ...current, causes: replaceAt(current.causes, index, { ...current.causes[index], name: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.description")}><textarea value={item.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, causes: replaceAt(current.causes, index, { ...current.causes[index], description: nullableText(event.target.value) }) }))} /></Field><Field label={t("caseEdit.labels.probabilitySource")}><input value={item.probabilitySource ?? ""} onChange={(event) => setDraft((current) => ({ ...current, causes: replaceAt(current.causes, index, { ...current.causes[index], probabilitySource: nullableText(event.target.value) }) }))} /></Field></div></article>
          ))}
        </Section>

        <Section count={draft.components.length} onAdd={() => { const id = newId(); setDraft((current) => ({ ...current, components: [...current.components, { id, nodeId: id, name: "", componentType: null, role: null }] })); }} title={t("sourceDetail.knowledge.sections.components")}>
          {draft.components.map((item, index) => (
            <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, components: removeAt(current.components, index) }))} /><div className="case-edit-grid"><Field label={t("caseEdit.labels.name")}><input required value={item.name} onChange={(event) => setDraft((current) => ({ ...current, components: replaceAt(current.components, index, { ...current.components[index], name: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.componentType")}><input value={item.componentType ?? ""} onChange={(event) => setDraft((current) => ({ ...current, components: replaceAt(current.components, index, { ...current.components[index], componentType: nullableText(event.target.value) }) }))} /></Field><Field label={t("caseEdit.labels.role")}><input value={item.role ?? ""} onChange={(event) => setDraft((current) => ({ ...current, components: replaceAt(current.components, index, { ...current.components[index], role: nullableText(event.target.value) }) }))} /></Field></div></article>
          ))}
        </Section>

        <Section count={draft.diagnosticChecks.length} onAdd={() => setDraft((current) => ({ ...current, diagnosticChecks: [...current.diagnosticChecks, { id: newId(), description: "", expectedResult: null, actualResult: null, interpretation: null, sequenceOrder: current.diagnosticChecks.length, measurements: [] }] }))} title={t("sourceDetail.knowledge.sections.checks")}>
          {draft.diagnosticChecks.map((item, index) => (
            <article className="case-edit-item" key={item.id}>
              <ItemActions canMoveDown={index < draft.diagnosticChecks.length - 1} canMoveUp={index > 0} onMoveDown={() => setDraft((current) => ({ ...current, diagnosticChecks: moveAt(current.diagnosticChecks, index, 1) }))} onMoveUp={() => setDraft((current) => ({ ...current, diagnosticChecks: moveAt(current.diagnosticChecks, index, -1) }))} onRemove={() => setDraft((current) => ({ ...current, diagnosticChecks: removeAt(current.diagnosticChecks, index) }))} />
              <div className="case-edit-grid"><Field label={t("caseEdit.labels.description")}><textarea required value={item.description} onChange={(event) => setDraft((current) => ({ ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...current.diagnosticChecks[index], description: event.target.value }) }))} /></Field><Field label={t("sourceDetail.knowledge.labels.expected")}><textarea value={item.expectedResult ?? ""} onChange={(event) => setDraft((current) => ({ ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...current.diagnosticChecks[index], expectedResult: nullableText(event.target.value) }) }))} /></Field><Field label={t("sourceDetail.knowledge.labels.actual")}><textarea value={item.actualResult ?? ""} onChange={(event) => setDraft((current) => ({ ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...current.diagnosticChecks[index], actualResult: nullableText(event.target.value) }) }))} /></Field><Field label={t("sourceDetail.knowledge.labels.interpretation")}><textarea value={item.interpretation ?? ""} onChange={(event) => setDraft((current) => ({ ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...current.diagnosticChecks[index], interpretation: nullableText(event.target.value) }) }))} /></Field></div>
              <div className="case-edit-nested"><h4>{t("caseEdit.sections.measurements")}</h4>{item.measurements.map((measurement, measurementIndex) => <div className="case-edit-nested-item" key={measurement.id}><ItemActions onRemove={() => setDraft((current) => { const check = current.diagnosticChecks[index]; return { ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...check, measurements: removeAt(check.measurements, measurementIndex) }) }; })} /><div className="case-edit-grid">{(["parameter", "valueText", "numericValue", "unit", "conditions", "minValue", "maxValue"] as const).map((field) => <Field key={field} label={t(`caseEdit.labels.${field}` as MessageKey)}><input required={field === "parameter"} value={measurement[field] ?? ""} onChange={(event) => setDraft((current) => { const check = current.diagnosticChecks[index]; return { ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...check, measurements: replaceAt(check.measurements, measurementIndex, { ...check.measurements[measurementIndex], [field]: field === "parameter" ? event.target.value : nullableText(event.target.value) }) }) }; })} /></Field>)}</div></div>)}<button className="case-edit-add" onClick={() => setDraft((current) => { const check = current.diagnosticChecks[index]; return { ...current, diagnosticChecks: replaceAt(current.diagnosticChecks, index, { ...check, measurements: [...check.measurements, { id: newId(), parameter: "", valueText: null, numericValue: null, unit: null, conditions: null, minValue: null, maxValue: null }] }) }; })} type="button">{t("caseEdit.actions.addMeasurement")}</button></div>
            </article>
          ))}
        </Section>

        <Section count={draft.solutions.length} onAdd={() => { const id = newId(); setDraft((current) => ({ ...current, solutions: [...current.solutions, { id, nodeId: id, name: "", description: null, probabilitySource: null, repairConfirmed: null, repairSuccessful: null, procedures: [], outcomes: [] }] })); }} title={t("sourceDetail.knowledge.sections.solutions")}>
          {draft.solutions.map((item, index) => (
            <article className="case-edit-item" key={item.id}>
              <ItemActions onRemove={() => setDraft((current) => ({ ...current, solutions: removeAt(current.solutions, index) }))} />
              <div className="case-edit-grid"><Field label={t("caseEdit.labels.name")}><input required value={item.name} onChange={(event) => setDraft((current) => ({ ...current, solutions: replaceAt(current.solutions, index, { ...current.solutions[index], name: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.description")}><textarea value={item.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, solutions: replaceAt(current.solutions, index, { ...current.solutions[index], description: nullableText(event.target.value) }) }))} /></Field><Field label={t("caseEdit.labels.probabilitySource")}><input value={item.probabilitySource ?? ""} onChange={(event) => setDraft((current) => ({ ...current, solutions: replaceAt(current.solutions, index, { ...current.solutions[index], probabilitySource: nullableText(event.target.value) }) }))} /></Field>{(["repairConfirmed", "repairSuccessful"] as const).map((field) => <Field key={field} label={t(`caseEdit.labels.${field}` as MessageKey)}><select value={item[field] === null ? "" : String(item[field])} onChange={(event) => setDraft((current) => ({ ...current, solutions: replaceAt(current.solutions, index, { ...current.solutions[index], [field]: triStateValue(event.target.value) }) }))}><option value="">{t("sourceDetail.unknown")}</option><option value="true">{t("sourceDetail.knowledge.values.yes")}</option><option value="false">{t("sourceDetail.knowledge.values.no")}</option></select></Field>)}</div>
              <div className="case-edit-nested"><h4>{t("caseEdit.sections.procedures")}</h4>{item.procedures.map((procedure, procedureIndex) => <div className="case-edit-nested-item" key={procedure.id}><ItemActions canMoveDown={procedureIndex < item.procedures.length - 1} canMoveUp={procedureIndex > 0} onMoveDown={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, procedures: moveAt(solution.procedures, procedureIndex, 1) }) }; })} onMoveUp={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, procedures: moveAt(solution.procedures, procedureIndex, -1) }) }; })} onRemove={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, procedures: removeAt(solution.procedures, procedureIndex) }) }; })} /><Field label={t("caseEdit.labels.instruction")}><textarea required value={procedure.instruction} onChange={(event) => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, procedures: replaceAt(solution.procedures, procedureIndex, { ...solution.procedures[procedureIndex], instruction: event.target.value }) }) }; })} /></Field></div>)}<button className="case-edit-add" onClick={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, procedures: [...solution.procedures, { id: newId(), instruction: "", sequenceOrder: solution.procedures.length }] }) }; })} type="button">{t("caseEdit.actions.addProcedure")}</button></div>
              <div className="case-edit-nested"><h4>{t("caseEdit.sections.outcomes")}</h4>{item.outcomes.map((outcome, outcomeIndex) => <div className="case-edit-nested-item" key={outcome.id}><ItemActions onRemove={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: removeAt(solution.outcomes, outcomeIndex) }) }; })} /><div className="case-edit-grid">{(["attempted", "successful", "confirmed"] as const).map((field) => <Field key={field} label={t(`caseEdit.labels.${field}` as MessageKey)}><select value={outcome[field] === null ? "" : String(outcome[field])} onChange={(event) => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: replaceAt(solution.outcomes, outcomeIndex, { ...solution.outcomes[outcomeIndex], [field]: triStateValue(event.target.value) }) }) }; })}><option value="">{t("sourceDetail.unknown")}</option><option value="true">{t("sourceDetail.knowledge.values.yes")}</option><option value="false">{t("sourceDetail.knowledge.values.no")}</option></select></Field>)}<Field label={t("caseEdit.labels.caseCount")}><input min="0" type="number" value={outcome.caseCount ?? ""} onChange={(event) => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: replaceAt(solution.outcomes, outcomeIndex, { ...solution.outcomes[outcomeIndex], caseCount: nullableInteger(event.target.value) }) }) }; })} /></Field><Field label={t("caseEdit.labels.successfulCaseCount")}><input min="0" type="number" value={outcome.successfulCaseCount ?? ""} onChange={(event) => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: replaceAt(solution.outcomes, outcomeIndex, { ...solution.outcomes[outcomeIndex], successfulCaseCount: nullableInteger(event.target.value) }) }) }; })} /></Field><Field label={t("caseEdit.labels.notes")}><textarea value={outcome.notes ?? ""} onChange={(event) => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: replaceAt(solution.outcomes, outcomeIndex, { ...solution.outcomes[outcomeIndex], notes: nullableText(event.target.value) }) }) }; })} /></Field></div></div>)}<button className="case-edit-add" onClick={() => setDraft((current) => { const solution = current.solutions[index]; return { ...current, solutions: replaceAt(current.solutions, index, { ...solution, outcomes: [...solution.outcomes, { id: newId(), attempted: null, successful: null, confirmed: null, caseCount: null, successfulCaseCount: null, notes: null }] }) }; })} type="button">{t("caseEdit.actions.addOutcome")}</button></div>
            </article>
          ))}
        </Section>

        <Section count={draft.partsMaterials.length} onAdd={() => setDraft((current) => ({ ...current, partsMaterials: [...current.partsMaterials, { id: newId(), name: "", partNumber: null, manufacturer: null, notes: null }] }))} title={t("sourceDetail.knowledge.sections.parts")}>
          {draft.partsMaterials.map((item, index) => <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, partsMaterials: removeAt(current.partsMaterials, index) }))} /><div className="case-edit-grid">{(["name", "partNumber", "manufacturer", "notes"] as const).map((field) => <Field key={field} label={t(`caseEdit.labels.${field}` as MessageKey)}>{field === "notes" ? <textarea value={item[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, partsMaterials: replaceAt(current.partsMaterials, index, { ...current.partsMaterials[index], [field]: nullableText(event.target.value) }) }))} /> : <input required={field === "name"} value={item[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, partsMaterials: replaceAt(current.partsMaterials, index, { ...current.partsMaterials[index], [field]: field === "name" ? event.target.value : nullableText(event.target.value) }) }))} />}</Field>)}</div></article>)}
        </Section>

        <Section count={draft.evidence.length} onAdd={() => setDraft((current) => ({ ...current, evidence: [...current.evidence, { id: newId(), excerpt: "", pageNumber: null, evidenceType: "UNCLEAR", entityType: null, entityId: null }] }))} title={t("sourceDetail.knowledge.sections.evidence")}>
          {draft.evidence.map((item, index) => <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, evidence: removeAt(current.evidence, index) }))} /><div className="case-edit-grid"><Field label={t("caseEdit.labels.excerpt")}><textarea required value={item.excerpt} onChange={(event) => setDraft((current) => ({ ...current, evidence: replaceAt(current.evidence, index, { ...current.evidence[index], excerpt: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.pageNumber")}><input min="1" type="number" value={item.pageNumber ?? ""} onChange={(event) => setDraft((current) => ({ ...current, evidence: replaceAt(current.evidence, index, { ...current.evidence[index], pageNumber: nullableInteger(event.target.value) }) }))} /></Field><Field label={t("caseEdit.labels.evidenceType")}><select value={item.evidenceType} onChange={(event) => setDraft((current) => ({ ...current, evidence: replaceAt(current.evidence, index, { ...current.evidence[index], evidenceType: event.target.value as typeof item.evidenceType }) }))}>{Object.entries(evidenceTypeKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></Field></div></article>)}
        </Section>

        <Section addDisabled={nodeOptions.length < 2} count={draft.relationships.length} onAdd={() => { const from = nodeOptions[0]; const to = nodeOptions[1]; if (!from || !to) return; setDraft((current) => ({ ...current, relationships: [...current.relationships, { id: newId(), fromType: from.type, fromId: from.id, relationshipType: "", toType: to.type, toId: to.id, sourceEvidenceId: null }] })); }} title={t("caseReview.relationships.title")}>
          {draft.relationships.map((item, index) => <article className="case-edit-item" key={item.id}><ItemActions onRemove={() => setDraft((current) => ({ ...current, relationships: removeAt(current.relationships, index) }))} /><div className="case-edit-grid">{(["from", "to"] as const).map((side) => <Field key={side} label={t(side === "from" ? "caseEdit.labels.relationshipFrom" : "caseEdit.labels.relationshipTo")}><select value={`${item[`${side}Type`]}:${item[`${side}Id`]}`} onChange={(event) => { const [type, ...idParts] = event.target.value.split(":"); const id = idParts.join(":"); setDraft((current) => ({ ...current, relationships: replaceAt(current.relationships, index, { ...current.relationships[index], [`${side}Type`]: type as NodeType, [`${side}Id`]: id }) })); }}>{nodeOptions.map((option) => <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>{t(nodeTypeKeys[option.type])}: {option.label}</option>)}</select></Field>)}<Field label={t("caseEdit.labels.relationshipType")}><input required value={item.relationshipType} onChange={(event) => setDraft((current) => ({ ...current, relationships: replaceAt(current.relationships, index, { ...current.relationships[index], relationshipType: event.target.value }) }))} /></Field><Field label={t("caseEdit.labels.relationshipEvidence")}><select value={item.sourceEvidenceId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, relationships: replaceAt(current.relationships, index, { ...current.relationships[index], sourceEvidenceId: nullableText(event.target.value) }) }))}><option value="">{t("sourceDetail.unknown")}</option>{draft.evidence.map((evidence) => <option key={evidence.id} value={evidence.id}>{evidence.excerpt.slice(0, 80)}</option>)}</select></Field></div></article>)}
        </Section>
      </div>

      <div className="case-edit-footer">
        <p>{t("caseEdit.saveNotice")}</p>
        <button className="primary-action" disabled={saveState === "saving"} type="submit">{t(saveState === "saving" ? "caseEdit.actions.saving" : "caseEdit.actions.save")}</button>
      </div>
    </form>
  );
}
