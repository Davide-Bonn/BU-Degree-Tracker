/**
 * RateMyProfessors scraper — library version callable from API routes.
 *
 * Extracts ratings and reviews for all instructors in CourseSchedule
 * using RMP's unofficial GraphQL API.
 */

import type { PrismaClient } from "@prisma/client";

// Boston University school ID on RateMyProfessors (base64 "School-124")
const BU_SCHOOL_ID = "U2Nob29sLTEyNA==";

const DEPT_RMP_KEYWORDS: Record<string, string> = {
  CS: "Computer Science",
  MA: "Math",
  WR: "Writing",
  AS: "Astron",
  PH: "Philosoph",
  BI: "Biol",
  CH: "Chemistr",
  EC: "Econom",
  PS: "Psycholog",
  SO: "Sociolog",
  EN: "English",
  HI: "Histor",
  PO: "Political",
  AN: "Anthropol",
  NE: "Neuro",
  MU: "Music",
  GE: "Geograph",
};

const RMP_GQL_SEARCH = `
  query TeacherSearchResultsPageQuery($query: TeacherSearchQuery!) {
    search: newSearch {
      teachers(query: $query) {
        edges {
          node {
            id
            firstName
            lastName
            avgRating
            avgDifficulty
            numRatings
            wouldTakeAgainPercent
            department
          }
        }
      }
    }
  }
`;

const RMP_GQL_RATINGS = `
  query TeacherRatingsPageQuery($id: ID!, $courseFilter: String) {
    node(id: $id) {
      ... on Teacher {
        ratings(first: 8, courseFilter: $courseFilter) {
          edges {
            node {
              comment
              date
              class
              clarityRating
              difficultyRating
              wouldTakeAgain
              grade
              thumbsUpTotal
              thumbsDownTotal
            }
          }
        }
      }
    }
  }
`;

interface RMPNode {
  id: string;
  firstName: string;
  lastName: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPercent: number | null;
  department: string | null;
}

interface RMPResult {
  id: string;
  fullName: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPct: number;
  department: string;
}

interface RMPReview {
  comment: string;
  date: string;
  class: string;
  clarityRating: number;
  difficultyRating: number;
  wouldTakeAgain: number | null;
  grade: string | null;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRMPEdges(searchTerm: string): Promise<{ node: RMPNode }[]> {
  const res = await fetch("https://www.ratemyprofessors.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic dGVzdDp0ZXN0",
      Origin: "https://www.ratemyprofessors.com",
    },
    body: JSON.stringify({
      query: RMP_GQL_SEARCH,
      variables: { query: { text: searchTerm, schoolID: BU_SCHOOL_ID } },
    }),
  });
  if (!res.ok) throw new Error(`RMP HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: { search: { teachers: { edges: { node: RMPNode }[] } } };
  };
  return json?.data?.search?.teachers?.edges ?? [];
}

async function fetchReviews(rmpId: string, courseFilter?: string): Promise<RMPReview[]> {
  const res = await fetch("https://www.ratemyprofessors.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic dGVzdDp0ZXN0",
      Origin: "https://www.ratemyprofessors.com",
    },
    body: JSON.stringify({
      query: RMP_GQL_RATINGS,
      variables: { id: rmpId, courseFilter: courseFilter ?? null },
    }),
  });
  if (!res.ok) throw new Error(`RMP HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: { node: { ratings: { edges: { node: RMPReview }[] } } };
  };
  return json?.data?.node?.ratings?.edges?.map((e) => e.node) ?? [];
}

function buCodeToRmpClass(buCode: string): string {
  const parts = buCode.trim().split(/\s+/);
  return parts.length >= 3 ? parts[1] + parts[2] : buCode;
}

function lastNamesCompatible(buName: string, rmpName: string): boolean {
  const a = buName.toLowerCase();
  const b = rmpName.toLowerCase();
  return a === b || a.startsWith(b);
}

async function searchRMP(lastName: string, deptCode: string): Promise<RMPResult | null> {
  const MIN_LEN = 8;
  let edges: { node: RMPNode }[] = [];

  for (let len = lastName.length; len >= Math.min(MIN_LEN, lastName.length); len--) {
    edges = await fetchRMPEdges(lastName.substring(0, len));
    if (edges.length > 0) break;
    if (len === lastName.length && lastName.length <= MIN_LEN) break;
  }

  if (edges.length === 0) return null;

  const compatible = edges.filter((e) => lastNamesCompatible(lastName, e.node.lastName));
  const candidates = compatible.length > 0 ? compatible : edges;

  let best: RMPNode | null = null;
  if (candidates.length === 1) {
    best = candidates[0].node;
  } else {
    const keyword = DEPT_RMP_KEYWORDS[deptCode.toUpperCase()];
    if (keyword) {
      const deptMatch = candidates.find((e) =>
        e.node.department?.toLowerCase().includes(keyword.toLowerCase())
      );
      if (deptMatch) best = deptMatch.node;
    }
    if (!best) {
      best = candidates.reduce((a, b) =>
        b.node.numRatings > a.node.numRatings ? b : a
      ).node;
    }
  }

  if (!best) return null;

  return {
    id: best.id,
    fullName: `${best.firstName} ${best.lastName}`.trim(),
    avgRating: best.avgRating ?? 0,
    avgDifficulty: best.avgDifficulty ?? 0,
    numRatings: best.numRatings ?? 0,
    wouldTakeAgainPct: best.wouldTakeAgainPercent ?? -1,
    department: best.department ?? "",
  };
}

export async function scrapeRMP(
  db: PrismaClient
): Promise<{ found: number; notFound: number; errors: number }> {
  const schedules = await db.courseSchedule.findMany({
    where: { instructor: { not: "" } },
    select: { instructor: true, course: { select: { code: true, department: true } } },
  });

  type InstructorEntry = { lastName: string; deptCode: string; courseCodes: Set<string> };
  const instructorInfo = new Map<string, InstructorEntry>();
  for (const s of schedules) {
    const deptCode = s.course.department ?? "";
    const key = `${s.instructor}|${deptCode}`;
    const info = instructorInfo.get(key) ?? {
      lastName: s.instructor,
      deptCode,
      courseCodes: new Set<string>(),
    };
    info.courseCodes.add(s.course.code);
    instructorInfo.set(key, info);
  }

  const instructors = Array.from(instructorInfo.values());
  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (const { lastName, deptCode, courseCodes } of instructors) {
    try {
      const result = await searchRMP(lastName, deptCode);
      if (result) {
        const rating = await db.professorRating.upsert({
          where: { name_department: { name: lastName, department: result.department } },
          create: {
            name: lastName,
            rmpId: result.id,
            avgRating: result.avgRating,
            avgDifficulty: result.avgDifficulty,
            numRatings: result.numRatings,
            wouldTakeAgainPct: result.wouldTakeAgainPct,
            department: result.department,
          },
          update: {
            rmpId: result.id,
            avgRating: result.avgRating,
            avgDifficulty: result.avgDifficulty,
            numRatings: result.numRatings,
            wouldTakeAgainPct: result.wouldTakeAgainPct,
            department: result.department,
          },
        });

        await sleep(300);
        const allReviews: RMPReview[] = [];
        const seenDates = new Set<string>();

        for (const buCode of courseCodes) {
          const rmpClass = buCodeToRmpClass(buCode);
          const courseReviews = await fetchReviews(result.id, rmpClass);
          await sleep(300);
          for (const r of courseReviews) {
            if (!seenDates.has(r.date)) {
              seenDates.add(r.date);
              allReviews.push(r);
            }
          }
        }

        if (allReviews.length < 8) {
          const general = await fetchReviews(result.id);
          await sleep(300);
          for (const r of general) {
            if (!seenDates.has(r.date) && allReviews.length < 8) {
              seenDates.add(r.date);
              allReviews.push(r);
            }
          }
        }

        await db.professorReview.deleteMany({ where: { professorId: rating.id } });
        for (const r of allReviews) {
          const dateStr = r.date?.substring(0, 10) ?? "";
          await db.professorReview.create({
            data: {
              professorId: rating.id,
              professorName: lastName,
              comment: r.comment ?? "",
              date: dateStr,
              rmpClass: r.class ?? "",
              clarityRating: r.clarityRating ?? 0,
              difficultyRating: r.difficultyRating ?? 0,
              wouldTakeAgain: r.wouldTakeAgain != null ? Boolean(r.wouldTakeAgain) : null,
              grade: r.grade ?? "",
              thumbsUpTotal: r.thumbsUpTotal ?? 0,
              thumbsDownTotal: r.thumbsDownTotal ?? 0,
            },
          });
        }

        found++;
      } else {
        notFound++;
      }
      await sleep(400);
    } catch (err) {
      console.error(`[scrape-rmp] Error for ${lastName}:`, err);
      errors++;
      await sleep(1000);
    }
  }

  return { found, notFound, errors };
}
