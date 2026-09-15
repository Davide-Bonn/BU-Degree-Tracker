import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canTakeCourse, getPrereqTree } from "@/lib/prerequisites";
import { notFound } from "next/navigation";
import Link from "next/link";
import CourseStatusButtons from "./CourseStatusButtons";

interface RMPRow {
  id: number;
  name: string;
  department: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPct: number;
  rmpId: string;
}

interface ReviewRow {
  professorName: string;
  comment: string;
  date: string;
  rmpClass: string;
  clarityRating: number;
  difficultyRating: number;
  wouldTakeAgain: number | null; // SQLite stores as 0/1/null
  grade: string;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
}

/** "CAS CS 131" → "CS131" — matches the rmpClass field stored from scraping */
function buCodeToRmpClass(buCode: string): string {
  const parts = buCode.trim().split(/\s+/);
  return parts.length >= 3 ? parts[1] + parts[2] : buCode;
}

// Maps BU dept codes to RMP department name keywords for disambiguation.
// Must match the same map in scripts/scrape-rmp.ts.
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

function RatingBadge({ rating }: { rating: RMPRow }) {
  const color =
    rating.avgRating >= 4 ? "#16a34a" : rating.avgRating >= 3 ? "#d97706" : "#dc2626";
  const rmpUrl = rating.rmpId
    ? `https://www.ratemyprofessors.com/professor/${Buffer.from(rating.rmpId, "base64").toString().replace("Teacher-", "")}`
    : null;
  const inner = (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}15`, color }}
    >
      ★ {rating.avgRating.toFixed(1)}
      {rating.numRatings > 0 && (
        <span className="font-normal opacity-70">({rating.numRatings})</span>
      )}
    </span>
  );
  return rmpUrl ? (
    <a href={rmpUrl} target="_blank" rel="noopener noreferrer" title="RateMyProfessors">
      {inner}
    </a>
  ) : inner;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      hubAreas: { include: { hubArea: true } },
      schedules: true,
      userProgress: true,
      prerequisiteLinks: {
        include: { prerequisite: { include: { userProgress: true } } },
      },
      prerequisiteOf: {
        include: { course: true },
      },
    },
  });

  if (!course) notFound();

  const canTakeResult = await canTakeCourse(course.id);
  const prereqTree = await getPrereqTree(course.id);
  const currentStatus = course.userProgress[0]?.status || null;
  const currentGrade = course.userProgress[0]?.grade || null;

  // Fetch RMP ratings for instructors in this course.
  // When multiple professors share a last name, filter by the course's department
  // so we pick the right Sullivan (CS vs. Math, etc.).
  const instructorNames = [...new Set(course.schedules.map((s) => s.instructor).filter(Boolean))];
  let rmpByName: Map<string, RMPRow> = new Map();
  let reviewsByInstructor: Map<string, ReviewRow[]> = new Map();

  if (instructorNames.length > 0) {
    try {
      const deptKeyword = DEPT_RMP_KEYWORDS[course.department] ?? "";

      // Prefer the record whose department matches this course's dept; fall back to any.
      const allRows = await prisma.$queryRaw<RMPRow[]>(
        Prisma.sql`SELECT id, name, avgRating, avgDifficulty, numRatings, wouldTakeAgainPct, rmpId
         FROM ProfessorRating WHERE name IN (${Prisma.join(instructorNames)})`
      );

      // For each instructor name, pick the best-matching row by dept keyword
      for (const name of instructorNames) {
        const matches = allRows.filter((r) => r.name === name);
        if (matches.length === 0) continue;
        const deptMatch = deptKeyword
          ? matches.find((r) => r.rmpId && r.department?.toLowerCase().includes(deptKeyword.toLowerCase()))
          : null;
        rmpByName.set(name, deptMatch ?? matches[0]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("does not exist") && !msg.includes("no such table")) {
        console.error("[RMP ratings]", msg);
      }
    }

    // Fetch stored reviews via professorId — course-specific reviews first.
    try {
      const rmpClass = buCodeToRmpClass(course.code);
      const profIds = [...rmpByName.values()].map((r) => r.id).filter(Boolean);

      if (profIds.length > 0) {
        const allReviews = await prisma.$queryRaw<ReviewRow[]>(
          Prisma.sql`SELECT * FROM ProfessorReview WHERE professorId IN (${Prisma.join(profIds)})
           ORDER BY CASE WHEN rmpClass = ${rmpClass} THEN 0 ELSE 1 END, date DESC`
        );
        for (const r of allReviews) {
          const list = reviewsByInstructor.get(r.professorName) ?? [];
          list.push(r);
          reviewsByInstructor.set(r.professorName, list);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("does not exist") && !msg.includes("no such table")) {
        console.error("[RMP reviews]", msg);
      }
    }
  }

  // Group schedules by semester
  const scheduleBySemester = new Map<string, typeof course.schedules>();
  for (const s of course.schedules) {
    const group = scheduleBySemester.get(s.semester) || [];
    group.push(s);
    scheduleBySemester.set(s.semester, group);
  }

  const statusColors: Record<string, string> = {
    completed: "text-success",
    "in-progress": "text-warning",
    planned: "text-info",
    "not-started": "text-muted",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/courses" className="text-sm text-muted hover:text-foreground">
        &larr; Back to courses
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{course.code}</h1>
          <p className="text-lg text-muted">{course.title}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{course.credits} credits</span>
        </div>
      </div>

      {/* Status + Can Take */}
      <div className="flex flex-wrap gap-3 items-center">
        <CourseStatusButtons courseId={course.id} currentStatus={currentStatus} currentGrade={currentGrade} />
      </div>

      {/* Can Take Indicator */}
      {course.prerequisiteLinks.length > 0 && (
        <div className={`p-3 rounded-md border text-sm ${
          canTakeResult.canTake
            ? "bg-success-light border-success/20 text-success"
            : "bg-accent-light border-accent/20 text-accent"
        }`}>
          {canTakeResult.canTake
            ? "You can take this course - all prerequisites are met."
            : "Prerequisites not met:"}
          {!canTakeResult.canTake && canTakeResult.missingPrereqs.length > 0 && (
            <ul className="mt-1 ml-4 list-disc">
              {canTakeResult.missingPrereqs.map((p) => (
                <li key={p.code}>{p.code}: {p.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Hub Areas */}
      {course.hubAreas.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-2">BU Hub Designations</h2>
          <div className="flex flex-wrap gap-2">
            {course.hubAreas.map((ha) => (
              <span key={ha.hubAreaId} className="text-xs bg-info-light text-info px-2 py-1 rounded-full">
                {ha.hubArea.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {course.description && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-2">Description</h2>
          <p className="text-sm leading-relaxed">{course.description}</p>
        </div>
      )}

      {/* Prerequisite Tree */}
      {prereqTree && prereqTree.children.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Prerequisite Chain</h2>
          <PrereqTreeView node={prereqTree} isRoot />
        </div>
      )}

      {/* Required By */}
      {course.prerequisiteOf.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-2">Required By</h2>
          <div className="flex flex-wrap gap-2">
            {course.prerequisiteOf.map((po) => (
              <Link
                key={po.courseId}
                href={`/courses/${po.course.slug}`}
                className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
              >
                {po.course.code}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      {course.schedules.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">Schedule</h2>
          {Array.from(scheduleBySemester.entries()).map(([semester, sections]) => (
            <div key={semester} className="mb-4 last:mb-0">
              <h3 className="text-sm font-medium mb-2">{semester}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b border-card-border">
                      <th className="pb-1 pr-3 font-medium">Section</th>
                      <th className="pb-1 pr-3 font-medium">Instructor</th>
                      <th className="pb-1 pr-3 font-medium">Time</th>
                      <th className="pb-1 pr-3 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((s) => {
                      const rmp = s.instructor ? rmpByName.get(s.instructor) : undefined;
                      return (
                        <tr key={s.id} className="border-b border-card-border/50">
                          <td className="py-1.5 pr-3">{s.section}</td>
                          <td className="py-1.5 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{s.instructor || "TBA"}</span>
                              {rmp && rmp.numRatings > 0 && <RatingBadge rating={rmp} />}
                            </div>
                          </td>
                          <td className="py-1.5 pr-3">{s.schedule || "TBA"}</td>
                          <td className="py-1.5 pr-3">{s.location || "TBA"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Reviews from RateMyProfessors */}
      {reviewsByInstructor.size > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4 space-y-5">
          <h2 className="font-semibold text-sm">
            Student Reviews{" "}
            <span className="text-muted font-normal">(via RateMyProfessors)</span>
          </h2>
          {instructorNames
            .filter((name) => reviewsByInstructor.has(name))
            .map((name) => {
              const reviews = reviewsByInstructor.get(name)!;
              const rmp = rmpByName.get(name);
              const rmpClass = buCodeToRmpClass(course.code);
              // Show course-specific reviews first; label others as "other courses"
              const courseReviews = reviews.filter((r) => r.rmpClass === rmpClass);
              const otherReviews = reviews.filter((r) => r.rmpClass !== rmpClass);
              const displayReviews = courseReviews.length > 0
                ? [...courseReviews, ...otherReviews].slice(0, 8)
                : reviews.slice(0, 8);
              return (
                <div key={name}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{name}</span>
                    {rmp && rmp.numRatings > 0 && <RatingBadge rating={rmp} />}
                    {courseReviews.length > 0 && (
                      <span className="text-xs text-muted">
                        {courseReviews.length} review{courseReviews.length !== 1 ? "s" : ""} for this course
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {displayReviews.map((r, i) => (
                      <ReviewCard
                        key={i}
                        review={r}
                        isCourseMatch={r.rmpClass === rmpClass}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* BU Link */}
      {course.url && (
        <a
          href={course.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-info hover:underline"
        >
          View on BU Bulletin &rarr;
        </a>
      )}
    </div>
  );
}

function ReviewCard({ review: r, isCourseMatch }: { review: ReviewRow; isCourseMatch: boolean }) {
  const clarityColor =
    r.clarityRating >= 4 ? "#16a34a" : r.clarityRating >= 3 ? "#d97706" : "#dc2626";
  const diffColor =
    r.difficultyRating <= 2 ? "#16a34a" : r.difficultyRating <= 3 ? "#d97706" : "#dc2626";

  return (
    <div
      className={`rounded-md border p-3 text-sm space-y-1.5 ${
        isCourseMatch
          ? "border-card-border bg-card"
          : "border-dashed border-card-border bg-gray-50/50 opacity-80"
      }`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{r.date ? new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</span>
        {r.rmpClass && !isCourseMatch && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
            {r.rmpClass}
          </span>
        )}
        {/* Clarity */}
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${clarityColor}15`, color: clarityColor }}
        >
          Clarity {r.clarityRating}/5
        </span>
        {/* Difficulty */}
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${diffColor}15`, color: diffColor }}
        >
          Difficulty {r.difficultyRating}/5
        </span>
        {/* Would take again */}
        {r.wouldTakeAgain != null && (
          <span
            className="px-1.5 py-0.5 rounded font-medium"
            style={
              r.wouldTakeAgain
                ? { backgroundColor: "#16a34a15", color: "#16a34a" }
                : { backgroundColor: "#dc262615", color: "#dc2626" }
            }
          >
            {r.wouldTakeAgain ? "Would take again" : "Would not take again"}
          </span>
        )}
        {r.grade && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            Grade: {r.grade}
          </span>
        )}
      </div>
      {/* Comment */}
      {r.comment && (
        <p className="leading-relaxed text-foreground">{r.comment}</p>
      )}
    </div>
  );
}

function PrereqTreeView({ node, isRoot = false }: { node: NonNullable<Awaited<ReturnType<typeof getPrereqTree>>>; isRoot?: boolean }) {
  const statusColors: Record<string, string> = {
    completed: "border-success bg-success-light",
    "in-progress": "border-warning bg-warning-light",
    planned: "border-info bg-info-light",
    "not-started": "border-gray-300 bg-gray-50",
  };

  return (
    <div className={`${isRoot ? "" : "ml-6 mt-2"}`}>
      {!isRoot && (
        <div className={`inline-block text-xs px-2 py-1 rounded border ${statusColors[node.status]}`}>
          {node.code}
          <span className="text-muted ml-1">({node.status})</span>
        </div>
      )}
      {node.children.length > 0 && (
        <div className={isRoot ? "" : "border-l border-card-border pl-2"}>
          {node.children.map((child) => (
            <PrereqTreeView key={child.courseId} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
