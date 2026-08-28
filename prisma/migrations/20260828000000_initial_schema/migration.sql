-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('pdf', 'email', 'whatsapp', 'text', 'audio', 'diagnostic_report', 'other');

-- CreateEnum
CREATE TYPE "source_status" AS ENUM ('uploaded', 'extracting_text', 'text_extracted', 'processing', 'persisted', 'schema_invalid', 'failed');

-- CreateEnum
CREATE TYPE "extraction_job_status" AS ENUM ('pending', 'running', 'completed', 'schema_invalid', 'failed');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('active', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('unreviewed', 'reviewed', 'corrected');

-- CreateEnum
CREATE TYPE "relation_origin" AS ENUM ('explicit_source', 'ai_inference', 'human_added');

-- CreateEnum
CREATE TYPE "dtc_relationship_type" AS ENUM ('primary', 'possible_cause', 'consequence', 'associated_fault', 'alternative_fault', 'same_system', 'secondary_code', 'unclear');

-- CreateEnum
CREATE TYPE "evidence_type" AS ENUM ('theoretical_possible_solution', 'manufacturer_documentation', 'technical_bulletin', 'workshop_report', 'real_case', 'confirmed_repair', 'multiple_confirmed_cases', 'unclear');

-- CreateEnum
CREATE TYPE "relationship_node_type" AS ENUM ('dtc', 'symptom', 'cause', 'diagnostic_check', 'solution', 'repair_outcome');

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "type" "source_type" NOT NULL,
    "status" "source_status" NOT NULL DEFAULT 'uploaded',
    "original_filename" TEXT,
    "mime_type" TEXT,
    "storage_path" TEXT,
    "raw_text" TEXT,
    "author" TEXT,
    "source_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" TEXT,
    "language" TEXT,
    "page_count" INTEGER,
    "pages_json" JSONB,
    "metadata_json" JSONB,
    "content_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_jobs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "status" "extraction_job_status" NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "prompt_version" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "raw_ai_output" JSONB,
    "validated_output" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "document_id" UUID,
    "extraction_job_id" UUID,
    "case_type" TEXT,
    "title" TEXT,
    "complaint" TEXT,
    "problem_description" TEXT,
    "analysis_summary" TEXT,
    "status" "case_status" NOT NULL DEFAULT 'active',
    "review_status" "review_status" NOT NULL DEFAULT 'unreviewed',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "generation" TEXT,
    "year_from" INTEGER,
    "year_to" INTEGER,
    "engine_description" TEXT,
    "engine_code" TEXT,
    "fuel_type" TEXT,
    "power" TEXT,
    "transmission" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_vehicles" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),
    "compatibility_note" TEXT,

    CONSTRAINT "case_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtcs" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "normalized_code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "dtcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_dtcs" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "dtc_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "relationship_type" "dtc_relationship_type" NOT NULL,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "case_dtcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_symptoms" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "symptom_id" UUID NOT NULL,
    "description" TEXT,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "case_symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causes" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_causes" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "cause_id" UUID NOT NULL,
    "description" TEXT,
    "probability_source" TEXT,
    "probability_calculated" DECIMAL(5,4),
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "case_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solutions" (
    "id" UUID NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_solutions" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "solution_id" UUID NOT NULL,
    "description" TEXT,
    "probability_source" TEXT,
    "probability_calculated" DECIMAL(5,4),
    "repair_confirmed" BOOLEAN,
    "repair_successful" BOOLEAN,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "case_solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "component_type" TEXT,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_components" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "role" TEXT,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "case_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_checks" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "expected_result" TEXT,
    "actual_result" TEXT,
    "interpretation" TEXT,
    "sequence_order" INTEGER,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "diagnostic_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "diagnostic_check_id" UUID,
    "parameter" TEXT NOT NULL,
    "value_text" TEXT,
    "numeric_value" DECIMAL(20,8),
    "unit" TEXT,
    "conditions" TEXT,
    "min_value" DECIMAL(20,8),
    "max_value" DECIMAL(20,8),
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_procedures" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "case_solution_id" UUID,
    "sequence_order" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "repair_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_materials" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "part_number" TEXT,
    "manufacturer" TEXT,
    "notes" TEXT,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "parts_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_outcomes" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "case_solution_id" UUID,
    "attempted" BOOLEAN,
    "successful" BOOLEAN,
    "confirmed" BOOLEAN,
    "case_count" INTEGER,
    "successful_case_count" INTEGER,
    "notes" TEXT,

    CONSTRAINT "repair_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_evidence" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "page_number" INTEGER,
    "excerpt" TEXT NOT NULL,
    "evidence_type" "evidence_type" NOT NULL,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "source_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "from_type" "relationship_node_type" NOT NULL,
    "from_id" UUID NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "to_type" "relationship_node_type" NOT NULL,
    "to_id" UUID NOT NULL,
    "relation_origin" "relation_origin" NOT NULL,
    "confidence" DECIMAL(5,4),
    "source_evidence_id" UUID,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "documents"
    ADD CONSTRAINT "documents_page_count_check"
    CHECK ("page_count" IS NULL OR "page_count" > 0),
    ADD CONSTRAINT "documents_content_hash_check"
    CHECK ("content_hash" IS NULL OR "content_hash" ~ '^[0-9a-f]{64}$');

-- AddCheckConstraint
ALTER TABLE "extraction_jobs"
    ADD CONSTRAINT "extraction_jobs_finished_at_check"
    CHECK ("started_at" IS NULL OR "finished_at" IS NULL OR "finished_at" >= "started_at");

-- AddCheckConstraint
ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_year_range_check"
    CHECK ("year_from" IS NULL OR "year_to" IS NULL OR "year_to" >= "year_from");

-- AddCheckConstraint
ALTER TABLE "case_dtcs"
    ADD CONSTRAINT "case_dtcs_primary_relationship_check"
    CHECK (
        ("is_primary" = true AND "relationship_type" = 'primary') OR
        ("is_primary" = false AND "relationship_type" <> 'primary')
    );

-- AddCheckConstraint
ALTER TABLE "case_causes"
    ADD CONSTRAINT "case_causes_probability_calculated_mvp_check"
    CHECK ("probability_calculated" IS NULL);

-- AddCheckConstraint
ALTER TABLE "case_solutions"
    ADD CONSTRAINT "case_solutions_probability_calculated_mvp_check"
    CHECK ("probability_calculated" IS NULL);

-- AddCheckConstraint
ALTER TABLE "diagnostic_checks"
    ADD CONSTRAINT "diagnostic_checks_sequence_order_check"
    CHECK ("sequence_order" IS NULL OR "sequence_order" >= 0);

-- AddCheckConstraint
ALTER TABLE "measurements"
    ADD CONSTRAINT "measurements_range_check"
    CHECK ("min_value" IS NULL OR "max_value" IS NULL OR "max_value" >= "min_value");

-- AddCheckConstraint
ALTER TABLE "repair_procedures"
    ADD CONSTRAINT "repair_procedures_sequence_order_check"
    CHECK ("sequence_order" >= 0);

-- AddCheckConstraint
ALTER TABLE "repair_outcomes"
    ADD CONSTRAINT "repair_outcomes_counts_check"
    CHECK (
        ("case_count" IS NULL OR "case_count" >= 0) AND
        ("successful_case_count" IS NULL OR "successful_case_count" >= 0) AND
        ("case_count" IS NULL OR "successful_case_count" IS NULL OR "successful_case_count" <= "case_count")
    );

-- AddCheckConstraint
ALTER TABLE "source_evidence"
    ADD CONSTRAINT "source_evidence_page_number_check"
    CHECK ("page_number" IS NULL OR "page_number" > 0);

-- AddCheckConstraint
ALTER TABLE "case_vehicles" ADD CONSTRAINT "case_vehicles_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "case_dtcs" ADD CONSTRAINT "case_dtcs_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "case_symptoms" ADD CONSTRAINT "case_symptoms_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "case_causes" ADD CONSTRAINT "case_causes_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "case_solutions" ADD CONSTRAINT "case_solutions_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "case_components" ADD CONSTRAINT "case_components_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "diagnostic_checks" ADD CONSTRAINT "diagnostic_checks_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "parts_materials" ADD CONSTRAINT "parts_materials_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);

-- EnableRowLevelSecurity
-- No public policies are defined. Prisma connects with a trusted server-side role.
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extraction_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dtcs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_dtcs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "symptoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_symptoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "causes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_causes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_solutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repair_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parts_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "repair_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE INDEX "sources_status_created_at_idx" ON "sources"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "documents_content_hash_key" ON "documents"("content_hash");

-- CreateIndex
CREATE INDEX "documents_source_id_idx" ON "documents"("source_id");

-- CreateIndex
CREATE INDEX "extraction_jobs_source_id_created_at_idx" ON "extraction_jobs"("source_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cases_source_id_idx" ON "cases"("source_id");

-- CreateIndex
CREATE INDEX "cases_document_id_idx" ON "cases"("document_id");

-- CreateIndex
CREATE INDEX "cases_extraction_job_id_idx" ON "cases"("extraction_job_id");

-- CreateIndex
CREATE INDEX "cases_status_review_created_at_idx" ON "cases"("status", "review_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "vehicles_brand_model_engine_code_idx" ON "vehicles"("brand", "model", "engine_code");

-- CreateIndex
CREATE INDEX "case_vehicles_vehicle_id_idx" ON "case_vehicles"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_vehicles_case_id_vehicle_id_key" ON "case_vehicles"("case_id", "vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "dtcs_normalized_code_key" ON "dtcs"("normalized_code");

-- CreateIndex
CREATE INDEX "case_dtcs_dtc_id_idx" ON "case_dtcs"("dtc_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_dtcs_case_id_dtc_id_key" ON "case_dtcs"("case_id", "dtc_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_dtcs_one_primary_per_case_key" ON "case_dtcs"("case_id") WHERE ("is_primary" = true);

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_normalized_name_key" ON "symptoms"("normalized_name");

-- CreateIndex
CREATE INDEX "case_symptoms_symptom_id_idx" ON "case_symptoms"("symptom_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_symptoms_case_id_symptom_id_key" ON "case_symptoms"("case_id", "symptom_id");

-- CreateIndex
CREATE UNIQUE INDEX "causes_normalized_name_key" ON "causes"("normalized_name");

-- CreateIndex
CREATE INDEX "case_causes_cause_id_idx" ON "case_causes"("cause_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_causes_case_id_cause_id_key" ON "case_causes"("case_id", "cause_id");

-- CreateIndex
CREATE UNIQUE INDEX "solutions_normalized_name_key" ON "solutions"("normalized_name");

-- CreateIndex
CREATE INDEX "case_solutions_solution_id_idx" ON "case_solutions"("solution_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_solutions_case_id_solution_id_key" ON "case_solutions"("case_id", "solution_id");

-- CreateIndex
CREATE UNIQUE INDEX "components_normalized_name_key" ON "components"("normalized_name");

-- CreateIndex
CREATE INDEX "case_components_component_id_idx" ON "case_components"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_components_case_id_component_id_key" ON "case_components"("case_id", "component_id");

-- CreateIndex
CREATE INDEX "diagnostic_checks_case_id_idx" ON "diagnostic_checks"("case_id");

-- CreateIndex
CREATE INDEX "measurements_case_id_idx" ON "measurements"("case_id");

-- CreateIndex
CREATE INDEX "measurements_diagnostic_check_id_idx" ON "measurements"("diagnostic_check_id");

-- CreateIndex
CREATE INDEX "repair_procedures_case_id_idx" ON "repair_procedures"("case_id");

-- CreateIndex
CREATE INDEX "repair_procedures_case_solution_id_idx" ON "repair_procedures"("case_solution_id");

-- CreateIndex
CREATE INDEX "parts_materials_case_id_idx" ON "parts_materials"("case_id");

-- CreateIndex
CREATE INDEX "repair_outcomes_case_id_idx" ON "repair_outcomes"("case_id");

-- CreateIndex
CREATE INDEX "repair_outcomes_case_solution_id_idx" ON "repair_outcomes"("case_solution_id");

-- CreateIndex
CREATE INDEX "source_evidence_source_id_idx" ON "source_evidence"("source_id");

-- CreateIndex
CREATE INDEX "source_evidence_case_id_idx" ON "source_evidence"("case_id");

-- CreateIndex
CREATE INDEX "source_evidence_entity_idx" ON "source_evidence"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "relationships_case_id_idx" ON "relationships"("case_id");

-- CreateIndex
CREATE INDEX "relationships_from_node_idx" ON "relationships"("from_type", "from_id");

-- CreateIndex
CREATE INDEX "relationships_to_node_idx" ON "relationships"("to_type", "to_id");

-- CreateIndex
CREATE INDEX "relationships_source_evidence_id_idx" ON "relationships"("source_evidence_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_extraction_job_id_fkey" FOREIGN KEY ("extraction_job_id") REFERENCES "extraction_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_vehicles" ADD CONSTRAINT "case_vehicles_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_vehicles" ADD CONSTRAINT "case_vehicles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_dtcs" ADD CONSTRAINT "case_dtcs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_dtcs" ADD CONSTRAINT "case_dtcs_dtc_id_fkey" FOREIGN KEY ("dtc_id") REFERENCES "dtcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_symptoms" ADD CONSTRAINT "case_symptoms_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_symptoms" ADD CONSTRAINT "case_symptoms_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_causes" ADD CONSTRAINT "case_causes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_causes" ADD CONSTRAINT "case_causes_cause_id_fkey" FOREIGN KEY ("cause_id") REFERENCES "causes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_solutions" ADD CONSTRAINT "case_solutions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_solutions" ADD CONSTRAINT "case_solutions_solution_id_fkey" FOREIGN KEY ("solution_id") REFERENCES "solutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_components" ADD CONSTRAINT "case_components_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_components" ADD CONSTRAINT "case_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_checks" ADD CONSTRAINT "diagnostic_checks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_diagnostic_check_id_fkey" FOREIGN KEY ("diagnostic_check_id") REFERENCES "diagnostic_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_procedures" ADD CONSTRAINT "repair_procedures_case_solution_id_fkey" FOREIGN KEY ("case_solution_id") REFERENCES "case_solutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_materials" ADD CONSTRAINT "parts_materials_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_outcomes" ADD CONSTRAINT "repair_outcomes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_outcomes" ADD CONSTRAINT "repair_outcomes_case_solution_id_fkey" FOREIGN KEY ("case_solution_id") REFERENCES "case_solutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_evidence_id_fkey" FOREIGN KEY ("source_evidence_id") REFERENCES "source_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
