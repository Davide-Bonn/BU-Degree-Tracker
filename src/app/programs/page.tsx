import { getOverallProgress } from "@/lib/progress";
import { getEffectiveUserId } from "@/lib/user";
import ProgramCard from "./ProgramCard";
import ProgramOverlap, { type OverlapCourse } from "./ProgramOverlap";
import ProgramsTour from "./ProgramsTour";

function statusOrder(s: string | null): number {
  if (s === "completed") return 0;
  if (s === "in-progress") return 1;
  if (s === "planned") return 2;
  if (s === null) return 3;
  return 4; // unexpected status sorts last
}

export default async function ProgramsPage() {
  const userId = await getEffectiveUserId();

  const progress = await getOverallProgress(userId);
  const programs = progress.programs;

  const majors = programs.filter((p) => p.type === "major");
  const minors = programs.filter((p) => p.type === "minor");
  const jointMajors = programs.filter((p) => p.type === "joint-major");

  const totalCoursesCompleted = progress.programs
    .flatMap((p) => p.groups.flatMap((g) => g.courses))
    .filter((c) => c.status === "completed")
    .map((c) => c.code);
  const uniqueCompleted = new Set(totalCoursesCompleted).size;

  const activeProgs = programs.filter((p) => p.isActive);
  const overlappingCourses: OverlapCourse[] = [];

  if (activeProgs.length >= 2) {
    const codeMap = new Map<
      string,
      {
        code: string;
        title: string | null;
        slug: string | null;
        status: string | null;
        programIds: Set<number>;
        programs: { id: number; name: string; type: string }[];
      }
    >();

    for (const prog of activeProgs) {
      for (const group of prog.groups) {
        for (const course of group.courses) {
          const existing = codeMap.get(course.code);
          if (existing) {
            if (!existing.programIds.has(prog.id)) {
              existing.programIds.add(prog.id);
              existing.programs.push({ id: prog.id, name: prog.name, type: prog.type });
            }
          } else {
            codeMap.set(course.code, {
              code: course.code,
              title: course.title,
              slug: course.slug,
              status: course.status,
              programIds: new Set([prog.id]),
              programs: [{ id: prog.id, name: prog.name, type: prog.type }],
            });
          }
        }
      }
    }

    for (const entry of codeMap.values()) {
      if (entry.programIds.size >= 2) {
        overlappingCourses.push({
          code: entry.code,
          title: entry.title,
          slug: entry.slug,
          status: entry.status,
          programs: entry.programs,
        });
      }
    }

    overlappingCourses.sort((a, b) => {
      const diff = statusOrder(a.status) - statusOrder(b.status);
      return diff !== 0 ? diff : a.code.localeCompare(b.code);
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <ProgramsTour />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programs & Minors</h1>
          <p className="text-sm text-muted mt-1">
            See how your completed courses apply toward each program — expand any card to browse requirements.
          </p>
        </div>
        <div className="text-right text-sm shrink-0">
          <p className="font-semibold text-lg text-accent">{uniqueCompleted}</p>
          <p className="text-xs text-muted">unique courses done</p>
        </div>
      </div>

      {overlappingCourses.length > 0 && (
        <div data-tour="programs-overlap">
          <ProgramOverlap courses={overlappingCourses} />
        </div>
      )}

      {majors.length > 0 && (
        <section data-tour="programs-list" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Major</h2>
          {majors.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </section>
      )}

      {minors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Minors</h2>
          <p className="text-xs text-muted -mt-1">
            Tap &quot;Show details&quot; to see which courses you still need for each minor.
          </p>
          {minors.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </section>
      )}

      {jointMajors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Joint Majors</h2>
          {jointMajors.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </section>
      )}

      {programs.length === 0 && (
        <p className="text-sm text-muted">No programs found in the database.</p>
      )}
    </div>
  );
}
