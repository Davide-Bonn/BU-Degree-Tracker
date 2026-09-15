// Current date for determining past/current/future semesters
function computeCurrentSemester(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  if (month >= 9) return `Fall ${year}`;
  if (month >= 6) return `Summer ${year}`;
  return `Spring ${year}`;
}
const CURRENT_SEMESTER = computeCurrentSemester();

const SEMESTER_ORDER = ["Spring", "Summer", "Fall"] as const;

function parseSemester(s: string): { term: string; year: number } | null {
  const match = s.match(/^(Spring|Summer|Fall)\s+(\d{4})$/);
  if (!match) return null;
  return { term: match[1], year: parseInt(match[2], 10) };
}

export function compareSemesters(a: string, b: string): number {
  const pa = parseSemester(a);
  const pb = parseSemester(b);
  if (!pa || !pb) return 0;
  if (pa.year !== pb.year) return pa.year - pb.year;
  return SEMESTER_ORDER.indexOf(pa.term as typeof SEMESTER_ORDER[number]) -
    SEMESTER_ORDER.indexOf(pb.term as typeof SEMESTER_ORDER[number]);
}

export function getSemesterType(semester: string): "past" | "current" | "future" {
  const cmp = compareSemesters(semester, CURRENT_SEMESTER);
  if (cmp < 0) return "past";
  if (cmp === 0) return "current";
  return "future";
}

export function getCurrentSemester(): string {
  return CURRENT_SEMESTER;
}

// Generate semester list from start to end in academic year order (Fall → Spring → Summer)
export function generateSemesters(startYear: number, endYear: number, includeSummer = true): string[] {
  const semesters: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    semesters.push(`Fall ${year}`);
    semesters.push(`Spring ${year + 1}`);
    if (includeSummer) semesters.push(`Summer ${year + 1}`);
  }
  return semesters;
}
