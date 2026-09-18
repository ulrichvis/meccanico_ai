import {
  automotiveExtractionSchema,
  type AutomotiveExtraction,
  type ExtractedAutomotiveCase,
} from "@/schemas/automotive-extraction.schema";

export type NormalizedRelationOrigin =
  | "EXPLICIT_SOURCE"
  | "AI_INFERENCE";

export type NormalizedReferenceType =
  | "case"
  | "vehicle"
  | "dtc"
  | "symptom"
  | "cause"
  | "component"
  | "diagnostic_check"
  | "solution"
  | "repair_procedure"
  | "measurement"
  | "part_material"
  | "repair_outcome"
  | "evidence"
  | "relationship";

export interface NormalizedReference {
  ref: string;
  type: NormalizedReferenceType;
}

type ExtractedVehicle = ExtractedAutomotiveCase["vehicles"][number];
type ExtractedDtc = NonNullable<ExtractedAutomotiveCase["primaryDtc"]>;
type ExtractedRelatedDtc = ExtractedAutomotiveCase["relatedDtcs"][number];
type ExtractedNamedEntity = ExtractedAutomotiveCase["symptoms"][number];
type ExtractedCause = ExtractedAutomotiveCase["causes"][number];
type ExtractedSolution = ExtractedAutomotiveCase["solutions"][number];
type ExtractedComponent = ExtractedAutomotiveCase["components"][number];

type WithDatabaseOrigin<T extends { relationOrigin: string }> = Omit<
  T,
  "relationOrigin"
> & {
  relationOrigin: NormalizedRelationOrigin;
};

export type NormalizedVehicle = WithDatabaseOrigin<ExtractedVehicle> & {
  lookupKey: string;
};

export type NormalizedDtc = WithDatabaseOrigin<
  ExtractedDtc | ExtractedRelatedDtc
> & {
  isPrimary: boolean;
  normalizedCode: string;
  relationshipType:
    | "PRIMARY"
    | "POSSIBLE_CAUSE"
    | "CONSEQUENCE"
    | "ASSOCIATED_FAULT"
    | "ALTERNATIVE_FAULT"
    | "SAME_SYSTEM"
    | "SECONDARY_CODE"
    | "UNCLEAR";
};

export type NormalizedNamedEntity = WithDatabaseOrigin<ExtractedNamedEntity> & {
  normalizedName: string;
};

export type NormalizedCause = WithDatabaseOrigin<ExtractedCause> & {
  normalizedName: string;
};

export type NormalizedSolution = WithDatabaseOrigin<ExtractedSolution> & {
  normalizedName: string;
};

export type NormalizedComponent = WithDatabaseOrigin<ExtractedComponent> & {
  normalizedName: string;
};

export interface NormalizedAutomotiveCase {
  ref: string;
  caseType: string | null;
  title: string | null;
  complaint: string | null;
  problemDescription: string | null;
  analysisSummary: null;
  status: "ACTIVE";
  reviewStatus: "UNREVIEWED";
  vehicles: NormalizedVehicle[];
  dtcs: NormalizedDtc[];
  symptoms: NormalizedNamedEntity[];
  causes: NormalizedCause[];
  components: NormalizedComponent[];
  diagnosticChecks: Array<
    WithDatabaseOrigin<ExtractedAutomotiveCase["diagnosticChecks"][number]>
  >;
  solutions: NormalizedSolution[];
  repairProcedures: Array<
    WithDatabaseOrigin<ExtractedAutomotiveCase["repairProcedures"][number]> & {
      solution: NormalizedReference | null;
    }
  >;
  measurements: Array<
    WithDatabaseOrigin<ExtractedAutomotiveCase["measurements"][number]> & {
      diagnosticCheck: NormalizedReference | null;
    }
  >;
  partsMaterials: Array<
    WithDatabaseOrigin<ExtractedAutomotiveCase["partsMaterials"][number]>
  >;
  repairOutcomes: Array<
    ExtractedAutomotiveCase["repairOutcomes"][number] & {
      solution: NormalizedReference | null;
    }
  >;
  evidence: Array<
    Omit<
      WithDatabaseOrigin<ExtractedAutomotiveCase["evidence"][number]>,
      "evidenceType"
    > & {
      evidenceType:
        | "THEORETICAL_POSSIBLE_SOLUTION"
        | "MANUFACTURER_DOCUMENTATION"
        | "TECHNICAL_BULLETIN"
        | "WORKSHOP_REPORT"
        | "REAL_CASE"
        | "CONFIRMED_REPAIR"
        | "MULTIPLE_CONFIRMED_CASES"
        | "UNCLEAR";
      target: NormalizedReference | null;
    }
  >;
  relationships: Array<
    Omit<
      WithDatabaseOrigin<ExtractedAutomotiveCase["relationships"][number]>,
      "fromType" | "toType"
    > & {
      evidence: NormalizedReference | null;
      from: NormalizedReference;
      fromType:
        | "DTC"
        | "SYMPTOM"
        | "CAUSE"
        | "DIAGNOSTIC_CHECK"
        | "SOLUTION"
        | "REPAIR_OUTCOME";
      to: NormalizedReference;
      toType:
        | "DTC"
        | "SYMPTOM"
        | "CAUSE"
        | "DIAGNOSTIC_CHECK"
        | "SOLUTION"
        | "REPAIR_OUTCOME";
    }
  >;
  references: NormalizedReference[];
}

export interface NormalizedAutomotiveExtraction {
  sourceMetadata: AutomotiveExtraction["source"];
  documentAnalysis: AutomotiveExtraction["documentAnalysis"];
  cases: NormalizedAutomotiveCase[];
}

export class AutomotiveNormalizationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AutomotiveNormalizationError";
  }
}

function normalizeLookupText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeDtcCode(code: string): string {
  return code.normalize("NFKC").trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeEntityName(name: string): string {
  return normalizeLookupText(name);
}

function databaseOrigin(
  origin: "explicit_source" | "ai_inference",
): NormalizedRelationOrigin {
  return origin === "explicit_source" ? "EXPLICIT_SOURCE" : "AI_INFERENCE";
}

const dtcRelationshipTypes = {
  possible_cause: "POSSIBLE_CAUSE",
  consequence: "CONSEQUENCE",
  associated_fault: "ASSOCIATED_FAULT",
  alternative_fault: "ALTERNATIVE_FAULT",
  same_system: "SAME_SYSTEM",
  secondary_code: "SECONDARY_CODE",
  unclear: "UNCLEAR",
} as const;

const evidenceTypes = {
  theoretical_possible_solution: "THEORETICAL_POSSIBLE_SOLUTION",
  manufacturer_documentation: "MANUFACTURER_DOCUMENTATION",
  technical_bulletin: "TECHNICAL_BULLETIN",
  workshop_report: "WORKSHOP_REPORT",
  real_case: "REAL_CASE",
  confirmed_repair: "CONFIRMED_REPAIR",
  multiple_confirmed_cases: "MULTIPLE_CONFIRMED_CASES",
  unclear: "UNCLEAR",
} as const;

const relationshipNodeTypes = {
  dtc: "DTC",
  symptom: "SYMPTOM",
  cause: "CAUSE",
  diagnostic_check: "DIAGNOSTIC_CHECK",
  solution: "SOLUTION",
  repair_outcome: "REPAIR_OUTCOME",
} as const;

function vehicleLookupKey(
  caseRef: string,
  vehicle: ExtractedVehicle,
): string {
  const identity = [
    vehicle.brand,
    vehicle.model,
    vehicle.generation,
    vehicle.yearFrom,
    vehicle.yearTo,
    vehicle.engineDescription,
    vehicle.engineCode,
    vehicle.fuelType,
    vehicle.power,
    vehicle.transmission,
  ].map((value) =>
    typeof value === "string" ? normalizeLookupText(value) : value,
  );
  const hasIdentity = identity.some((value) => value !== null);

  return hasIdentity
    ? `shared:${JSON.stringify(identity)}`
    : `local:${caseRef}:${vehicle.ref}`;
}

function normalizeCase(extractedCase: ExtractedAutomotiveCase): NormalizedAutomotiveCase {
  const registry = new Map<string, NormalizedReference>();

  const register = (ref: string, type: NormalizedReferenceType) => {
    if (registry.has(ref)) {
      throw new AutomotiveNormalizationError("DUPLICATE_NORMALIZATION_REFERENCE");
    }
    const reference = { ref, type } satisfies NormalizedReference;
    registry.set(ref, reference);
    return reference;
  };
  const resolve = (
    ref: string | null,
    expectedType?: NormalizedReferenceType,
  ): NormalizedReference | null => {
    if (ref === null) return null;
    const reference = registry.get(ref);
    if (!reference) {
      throw new AutomotiveNormalizationError("NORMALIZATION_REFERENCE_NOT_FOUND");
    }
    if (expectedType && reference.type !== expectedType) {
      throw new AutomotiveNormalizationError("NORMALIZATION_REFERENCE_TYPE_INVALID");
    }
    return reference;
  };

  register(extractedCase.ref, "case");
  extractedCase.vehicles.forEach((item) => register(item.ref, "vehicle"));
  if (extractedCase.primaryDtc) register(extractedCase.primaryDtc.ref, "dtc");
  extractedCase.relatedDtcs.forEach((item) => register(item.ref, "dtc"));
  extractedCase.symptoms.forEach((item) => register(item.ref, "symptom"));
  extractedCase.causes.forEach((item) => register(item.ref, "cause"));
  extractedCase.components.forEach((item) => register(item.ref, "component"));
  extractedCase.diagnosticChecks.forEach((item) =>
    register(item.ref, "diagnostic_check"),
  );
  extractedCase.solutions.forEach((item) => register(item.ref, "solution"));
  extractedCase.repairProcedures.forEach((item) =>
    register(item.ref, "repair_procedure"),
  );
  extractedCase.measurements.forEach((item) => register(item.ref, "measurement"));
  extractedCase.partsMaterials.forEach((item) =>
    register(item.ref, "part_material"),
  );
  extractedCase.repairOutcomes.forEach((item) =>
    register(item.ref, "repair_outcome"),
  );
  extractedCase.evidence.forEach((item) => register(item.ref, "evidence"));
  extractedCase.relationships.forEach((item) =>
    register(item.ref, "relationship"),
  );

  const primaryDtc: NormalizedDtc[] = extractedCase.primaryDtc
    ? [
        {
          ...extractedCase.primaryDtc,
          isPrimary: true,
          normalizedCode: normalizeDtcCode(extractedCase.primaryDtc.code),
          relationOrigin: databaseOrigin(extractedCase.primaryDtc.relationOrigin),
          relationshipType: "PRIMARY",
        },
      ]
    : [];

  return {
    ref: extractedCase.ref,
    caseType: extractedCase.caseType,
    title: extractedCase.title,
    complaint: extractedCase.complaint,
    problemDescription: extractedCase.problemDescription,
    analysisSummary: null,
    status: "ACTIVE",
    reviewStatus: "UNREVIEWED",
    vehicles: extractedCase.vehicles.map((item) => ({
      ...item,
      lookupKey: vehicleLookupKey(extractedCase.ref, item),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    dtcs: [
      ...primaryDtc,
      ...extractedCase.relatedDtcs.map((item) => ({
        ...item,
        isPrimary: false,
        normalizedCode: normalizeDtcCode(item.code),
        relationOrigin: databaseOrigin(item.relationOrigin),
        relationshipType: dtcRelationshipTypes[item.relationshipType],
      })),
    ],
    symptoms: extractedCase.symptoms.map((item) => ({
      ...item,
      normalizedName: normalizeEntityName(item.name),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    causes: extractedCase.causes.map((item) => ({
      ...item,
      normalizedName: normalizeEntityName(item.name),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    components: extractedCase.components.map((item) => ({
      ...item,
      normalizedName: normalizeEntityName(item.name),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    diagnosticChecks: extractedCase.diagnosticChecks.map((item) => ({
      ...item,
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    solutions: extractedCase.solutions.map((item) => ({
      ...item,
      normalizedName: normalizeEntityName(item.name),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    repairProcedures: extractedCase.repairProcedures.map((item) => ({
      ...item,
      relationOrigin: databaseOrigin(item.relationOrigin),
      solution: resolve(item.solutionRef, "solution"),
    })),
    measurements: extractedCase.measurements.map((item) => ({
      ...item,
      diagnosticCheck: resolve(item.diagnosticCheckRef, "diagnostic_check"),
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    partsMaterials: extractedCase.partsMaterials.map((item) => ({
      ...item,
      relationOrigin: databaseOrigin(item.relationOrigin),
    })),
    repairOutcomes: extractedCase.repairOutcomes.map((item) => ({
      ...item,
      solution: resolve(item.solutionRef, "solution"),
    })),
    evidence: extractedCase.evidence.map((item) => ({
      ...item,
      evidenceType: evidenceTypes[item.evidenceType],
      relationOrigin: databaseOrigin(item.relationOrigin),
      target: resolve(item.targetRef),
    })),
    relationships: extractedCase.relationships.map((item) => ({
      ...item,
      evidence: resolve(item.evidenceRef, "evidence"),
      from: resolve(
        item.fromRef,
        item.fromType as NormalizedReferenceType,
      )!,
      fromType: relationshipNodeTypes[item.fromType],
      relationOrigin: databaseOrigin(item.relationOrigin),
      to: resolve(item.toRef, item.toType as NormalizedReferenceType)!,
      toType: relationshipNodeTypes[item.toType],
    })),
    references: [...registry.values()],
  };
}

export function normalizeAutomotiveExtraction(
  input: unknown,
): NormalizedAutomotiveExtraction {
  const extraction = automotiveExtractionSchema.parse(input);

  return {
    sourceMetadata: extraction.source,
    documentAnalysis: extraction.documentAnalysis,
    cases: extraction.cases.map(normalizeCase),
  };
}
