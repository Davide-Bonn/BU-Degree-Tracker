/**
 * POST /api/planner/generate
 *
 * Generates up to 10 distinct plan scenarios and saves them to the database.
 * Returns the full serialized scenarios so the client can display them immediately.
 * Plans are validated — only valid plans are returned when possible, but invalid
 * plans may be included to fill slots if fewer than 10 valid plans are found.
 *
 * Body: {
 *   pinnedCourses?:       { courseId: number; semester: string }[]
 *   endSemesterOverride?: string        // e.g. "Spring 2028"
 *   preference?:          "hub" | "major" | "balanced"
 *   maxCoursesPerSem?:    3 | 4 | 5    // default 4
 *   majorCoursesPerSem?:  0 | 2 | 3    // default 2  (0 = no limit)
 * }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";
import { generateAllPlans } from "@/lib/plan-generator";

export async function POST(request: Request) {
  const userId = await getEffectiveUserId();
  const body = await request.json().catch(() => ({})) as {
    pinnedCourses?:       { courseId: number; semester: string }[];
    endSemesterOverride?: string;
    preference?:          "hub" | "major" | "balanced";
    maxCoursesPerSem?:    3 | 4 | 5;
    majorCoursesPerSem?:  0 | 2 | 3;
  };

  const pinnedCourses       = body.pinnedCourses ?? [];
  const endSemesterOverride = body.endSemesterOverride;
  const preference          = body.preference ?? "balanced";
  const maxCoursesPerSem    = body.maxCoursesPerSem ?? 4;
  const majorCoursesPerSem  = body.majorCoursesPerSem ?? 2;

  // Generate plans (may return fewer than 10 if not enough valid variants found)
  const results = await generateAllPlans(
    userId,
    pinnedCourses,
    endSemesterOverride,
    { maxCoursesPerSem, majorCoursesPerSem },
  );

  // Reorder by preference so the user's preferred strategy appears first.
  // Use variantIndex-based ordering, handling that some indices may be missing.
  const preferenceOrder: Record<string, number[]> = {
    hub:      [0, 5, 6, 2, 3, 4, 1, 7, 8, 9],
    major:    [1, 7, 8, 2, 3, 4, 0, 5, 6, 9],
    balanced: [2, 3, 4, 0, 5, 6, 1, 7, 8, 9],
  };
  const order = preferenceOrder[preference] ?? preferenceOrder.balanced;

  // Build a map from variantIndex to result(s)
  const byVariant = new Map<number, typeof results>();
  for (const r of results) {
    if (!byVariant.has(r.variantIndex)) byVariant.set(r.variantIndex, []);
    byVariant.get(r.variantIndex)!.push(r);
  }

  // Sort: valid plans first within each variant group, then by preference order
  const sorted: typeof results = [];
  const usedIndices = new Set<number>();
  for (const idx of order) {
    const group = byVariant.get(idx);
    if (!group) continue;
    // Pick first valid, or first if none valid
    const pick = group.find((r) => r.validation.valid) ?? group[0];
    if (pick && !usedIndices.has(idx)) {
      sorted.push(pick);
      usedIndices.add(idx);
    }
  }
  // Add any remaining results not covered by the preference order
  for (const r of results) {
    if (!usedIndices.has(r.variantIndex)) {
      sorted.push(r);
      usedIndices.add(r.variantIndex);
    }
  }

  const now = new Date();

  const created = await Promise.all(
    sorted.map((r) =>
      prisma.planScenario.create({
        data: {
          userId,
          name: `${r.name} — ${now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
          courses: {
            create: r.assignments.map((a) => ({
              courseId: a.courseId,
              semester:  a.semester,
              pinned:    a.pinned,
            })),
          },
        },
        include: {
          courses: {
            include: {
              course: {
                select: {
                  id: true, code: true, title: true, credits: true,
                  hubAreas: { include: { hubArea: { select: { code: true, name: true } } } },
                  prerequisiteLinks: {
                    select: { prerequisiteId: true, prerequisite: { select: { code: true } } },
                  },
                  schedules: {
                    select: { semester: true, days: true, startTime: true, endTime: true },
                    where: { days: { not: "" }, startTime: { not: "" }, endTime: { not: "" } },
                  },
                },
              },
            },
          },
        },
      })
    )
  );

  const serialized = created.map((s, idx) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    favourited: false,
    earliestFinish: sorted[idx]?.earliestFinish ?? null,
    validation: sorted[idx]?.validation ?? { valid: false, missing: [] },
    courses: s.courses.map((sc) => ({
      courseId:  sc.courseId,
      code:      sc.course.code,
      title:     sc.course.title,
      credits:   sc.course.credits,
      semester:  sc.semester,
      pinned:    sc.pinned,
      hubAreas:  sc.course.hubAreas.map((ha) => ({ code: ha.hubArea.code, name: ha.hubArea.name })),
      prereqs:   sc.course.prerequisiteLinks.map((pl) => ({ courseId: pl.prerequisiteId, code: pl.prerequisite.code })),
      sections: (() => {
        const seen = new Set<string>();
        return sc.course.schedules
          .map((s) => ({ term: s.semester.split(" ")[0], days: s.days, startTime: s.startTime, endTime: s.endTime }))
          .filter((s) => { const k = `${s.term}|${s.days}|${s.startTime}|${s.endTime}`; return seen.has(k) ? false : (seen.add(k), true); });
      })(),
    })),
  }));

  return NextResponse.json({ scenarios: serialized });
}
