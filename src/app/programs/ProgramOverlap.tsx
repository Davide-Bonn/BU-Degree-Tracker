import Link from "next/link";

export type OverlapCourse = {
  code: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  programs: { id: number; name: string; type: string }[];
};

const TYPE_COLORS: Record<string, string> = {
  major: "bg-accent-light text-accent",
  minor: "bg-info-light text-info",
  "joint-major": "bg-success-light text-success",
};

const STATUS_DOT: Record<string, string> = {
  completed: "bg-success",
  "in-progress": "bg-warning",
  planned: "bg-info",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-success-light text-success",
  "in-progress": "bg-warning-light text-warning",
  planned: "bg-info-light text-info",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "✓ Done",
  "in-progress": "In Progress",
  planned: "Planned",
};

export default function ProgramOverlap({ courses }: { courses: OverlapCourse[] }) {
  if (courses.length === 0) return null;

  const tracked = courses.filter((c) => c.status !== null);
  const untracked = courses.filter((c) => c.status === null);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          Course Overlap
          <span className="ml-2 text-xs font-normal normal-case text-muted bg-gray-100 px-2 py-0.5 rounded-full">
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </span>
        </h2>
        <p className="text-xs text-muted mt-1">
          These courses satisfy requirements in multiple active programs — taking one counts toward both.
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="divide-y divide-card-border">
          {courses.map((c) => (
            <div key={c.code} className="flex items-center gap-3 px-4 py-3">
              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[c.status ?? ""] ?? "bg-gray-300"}`}
              />

              {/* Course code + title */}
              <div className="flex-1 min-w-0">
                {c.slug ? (
                  <Link
                    href={`/courses/${c.slug}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {c.code}
                  </Link>
                ) : (
                  <span className="font-medium text-sm">{c.code}</span>
                )}
                {c.title && (
                  <span className="text-xs text-muted ml-1.5 truncate">{c.title}</span>
                )}
              </div>

              {/* Program tags + status badge */}
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {c.programs.map((p) => (
                  <span
                    key={p.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      TYPE_COLORS[p.type] ?? "bg-gray-100 text-muted"
                    }`}
                  >
                    {p.name}
                  </span>
                ))}
                {c.status && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      STATUS_BADGE[c.status] ?? "bg-gray-100 text-muted"
                    }`}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer summary */}
        {tracked.length > 0 && untracked.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-card-border text-xs text-muted">
            {tracked.length} already tracked · {untracked.length} not yet started
          </div>
        )}
      </div>
    </section>
  );
}
