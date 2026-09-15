import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

interface ReviewRow {
  id: number;
  professorName: string;
  comment: string;
  date: string;
  rmpClass: string;
  clarityRating: number;
  difficultyRating: number;
  wouldTakeAgain: number | null;
  grade: string;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
}

function rmpProfileUrl(rmpId: string): string | null {
  if (!rmpId) return null;
  try {
    const decoded = Buffer.from(rmpId, "base64").toString();
    const id = decoded.replace("Teacher-", "");
    return `https://www.ratemyprofessors.com/professor/${id}`;
  } catch {
    return null;
  }
}

function RatingCircle({
  value,
  max,
  label,
  invert = false,
}: {
  value: number;
  max: number;
  label: string;
  invert?: boolean;
}) {
  const pct = max > 0 ? value / max : 0;
  const good = invert ? pct <= 0.4 : pct >= 0.8;
  const ok = invert ? pct <= 0.6 : pct >= 0.6;
  const color = good ? "text-success" : ok ? "text-warning" : "text-accent";
  const display = max === 100 ? `${Math.round(value)}%` : value.toFixed(1);
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold ${color}`}>{display}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function ReviewCard({ r }: { r: ReviewRow }) {
  const clarityColor =
    r.clarityRating >= 4 ? "#16a34a" : r.clarityRating >= 3 ? "#d97706" : "#dc2626";
  const diffColor =
    r.difficultyRating <= 2 ? "#16a34a" : r.difficultyRating <= 3 ? "#d97706" : "#dc2626";

  return (
    <div className="rounded-md border border-card-border bg-card p-3 text-sm space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          {r.date
            ? new Date(r.date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </span>
        {r.rmpClass && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">
            {r.rmpClass}
          </span>
        )}
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${clarityColor}15`, color: clarityColor }}
        >
          Clarity {r.clarityRating}/5
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${diffColor}15`, color: diffColor }}
        >
          Difficulty {r.difficultyRating}/5
        </span>
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
        {(r.thumbsUpTotal > 0 || r.thumbsDownTotal > 0) && (
          <span className="text-muted">
            👍 {r.thumbsUpTotal} · 👎 {r.thumbsDownTotal}
          </span>
        )}
      </div>
      {r.comment && <p className="leading-relaxed text-foreground">{r.comment}</p>}
    </div>
  );
}

export default async function ProfessorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profId = parseInt(id, 10);
  if (isNaN(profId)) notFound();

  const professor = await prisma.professorRating.findUnique({
    where: { id: profId },
    include: { reviews: { orderBy: { date: "desc" } } },
  });

  if (!professor) notFound();

  // Find all courses this instructor teaches via CourseSchedule
  const schedules = await prisma.courseSchedule.findMany({
    where: { instructor: professor.name },
    include: { course: { select: { code: true, title: true, slug: true } } },
    orderBy: [{ semester: "desc" }, { course: { code: "asc" } }],
  });

  // Deduplicate: group by course code, collect semesters
  const courseMap = new Map<
    string,
    { code: string; title: string; slug: string; semesters: Set<string> }
  >();
  for (const s of schedules) {
    const entry = courseMap.get(s.course.code) ?? {
      code: s.course.code,
      title: s.course.title,
      slug: s.course.slug,
      semesters: new Set<string>(),
    };
    if (s.semester) entry.semesters.add(s.semester);
    courseMap.set(s.course.code, entry);
  }
  const coursesTaught = Array.from(courseMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const rmpUrl = rmpProfileUrl(professor.rmpId);

  // Group reviews by rmpClass for display
  const reviews = professor.reviews as unknown as ReviewRow[];
  const classCounts = new Map<string, number>();
  for (const r of reviews) {
    if (r.rmpClass) classCounts.set(r.rmpClass, (classCounts.get(r.rmpClass) ?? 0) + 1);
  }
  const topClasses = Array.from(classCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cls]) => cls);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/professors" className="text-sm text-muted hover:text-foreground">
        ← Back to professors
      </Link>

      {/* Header */}
      <div className="bg-card border border-card-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{professor.name}</h1>
            {professor.department && (
              <p className="text-muted mt-0.5">{professor.department}</p>
            )}
          </div>
          {rmpUrl && (
            <a
              href={rmpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-info hover:underline shrink-0"
            >
              View on RateMyProfessors →
            </a>
          )}
        </div>

        {professor.numRatings > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-6 border-t border-card-border">
            <RatingCircle value={professor.avgRating} max={5} label="Overall Rating" />
            <RatingCircle
              value={professor.avgDifficulty}
              max={5}
              label="Difficulty"
              invert
            />
            {professor.wouldTakeAgainPct >= 0 && (
              <RatingCircle
                value={professor.wouldTakeAgainPct}
                max={100}
                label="Would Take Again"
              />
            )}
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{professor.numRatings}</p>
              <p className="text-xs text-muted mt-1">Total Reviews</p>
            </div>
          </div>
        )}
      </div>

      {/* Courses Taught */}
      {coursesTaught.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="font-semibold text-sm mb-3">
            Courses Taught{" "}
            <span className="text-muted font-normal">({coursesTaught.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coursesTaught.map((c) => (
              <Link
                key={c.code}
                href={`/courses/${c.slug}`}
                className="flex items-start justify-between gap-2 p-2.5 rounded-md border border-card-border hover:border-accent/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{c.code}</p>
                  <p className="text-xs text-muted truncate">{c.title}</p>
                </div>
                {c.semesters.size > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {Array.from(c.semesters)
                      .slice(0, 3)
                      .map((sem) => (
                        <span
                          key={sem}
                          className="text-[10px] bg-gray-100 text-muted px-1.5 py-0.5 rounded"
                        >
                          {sem}
                        </span>
                      ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Most-reviewed classes badge strip */}
      {topClasses.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted">Most reviewed:</span>
          {topClasses.map((cls) => (
            <span
              key={cls}
              className="text-xs bg-info-light text-info px-2 py-0.5 rounded-full font-medium"
            >
              {cls} ({classCounts.get(cls)})
            </span>
          ))}
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">
            Student Reviews{" "}
            <span className="text-muted font-normal">
              ({reviews.length} via RateMyProfessors)
            </span>
          </h2>
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No reviews on record for this professor.</p>
      )}
    </div>
  );
}
