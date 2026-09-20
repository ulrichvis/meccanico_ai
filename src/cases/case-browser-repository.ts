import "server-only";

import { getDatabaseClient } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { CaseStatus, ReviewStatus } from "@/generated/prisma/enums";
import type { CaseBrowserQuery } from "@/schemas/case-browser-query.schema";

export interface BrowsableCase {
  caseType: string | null;
  complaint: string | null;
  dtcs: Array<{
    code: string;
    isPrimary: boolean;
  }>;
  id: string;
  reviewStatus: string;
  source: {
    id: string;
    originalFilename: string | null;
  };
  status: string;
  title: string | null;
  updatedAt: string;
  vehicles: Array<{
    brand: string | null;
    engineCode: string | null;
    engineDescription: string | null;
    model: string | null;
  }>;
}

export const CASE_BROWSER_LIMIT = 50;

const caseStatusByFilter = {
  active: CaseStatus.ACTIVE,
  archived: CaseStatus.ARCHIVED,
  rejected: CaseStatus.REJECTED,
} satisfies Record<CaseBrowserQuery["status"], CaseStatus>;

const reviewStatusByFilter = {
  corrected: ReviewStatus.CORRECTED,
  reviewed: ReviewStatus.REVIEWED,
  unreviewed: ReviewStatus.UNREVIEWED,
} satisfies Record<Exclude<CaseBrowserQuery["review"], "all">, ReviewStatus>;

function normalizeDtcQuery(query: string): string {
  return query.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

function createSearchConditions(query: string): Prisma.CaseWhereInput[] {
  if (!query) {
    return [];
  }

  const textFilter = { contains: query, mode: "insensitive" as const };
  const normalizedDtcQuery = normalizeDtcQuery(query);
  const dtcConditions: Prisma.DtcWhereInput[] = [{ code: textFilter }];

  if (normalizedDtcQuery) {
    dtcConditions.push({
      normalizedCode: { contains: normalizedDtcQuery, mode: "insensitive" },
    });
  }

  return [
    { title: textFilter },
    {
      dtcs: {
        some: {
          dtc: { OR: dtcConditions },
        },
      },
    },
    {
      vehicles: {
        some: {
          vehicle: {
            OR: [
              { brand: textFilter },
              { model: textFilter },
              { engineCode: textFilter },
              { engineDescription: textFilter },
            ],
          },
        },
      },
    },
  ];
}

export async function listCases(filters: CaseBrowserQuery): Promise<BrowsableCase[]> {
  const where: Prisma.CaseWhereInput = {
    status: caseStatusByFilter[filters.status],
  };

  if (filters.review !== "all") {
    where.reviewStatus = reviewStatusByFilter[filters.review];
  }

  const searchConditions = createSearchConditions(filters.q);
  if (searchConditions.length > 0) {
    where.OR = searchConditions;
  }

  const cases = await getDatabaseClient().case.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      caseType: true,
      complaint: true,
      dtcs: {
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        select: {
          dtc: { select: { code: true } },
          isPrimary: true,
        },
        take: 4,
      },
      id: true,
      reviewStatus: true,
      source: {
        select: {
          id: true,
          originalFilename: true,
        },
      },
      status: true,
      title: true,
      updatedAt: true,
      vehicles: {
        orderBy: { id: "asc" },
        select: {
          vehicle: {
            select: {
              brand: true,
              engineCode: true,
              engineDescription: true,
              model: true,
            },
          },
        },
        take: 3,
      },
    },
    take: CASE_BROWSER_LIMIT,
    where,
  });

  return cases.map((item) => ({
    caseType: item.caseType,
    complaint: item.complaint,
    dtcs: item.dtcs.map((entry) => ({
      code: entry.dtc.code,
      isPrimary: entry.isPrimary,
    })),
    id: item.id,
    reviewStatus: item.reviewStatus,
    source: item.source,
    status: item.status,
    title: item.title,
    updatedAt: item.updatedAt.toISOString(),
    vehicles: item.vehicles.map((entry) => entry.vehicle),
  }));
}
