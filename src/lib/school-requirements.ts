/**
 * School-specific graduation requirements.
 *
 * Each school defines a set of requirements beyond universal credits/GPA.
 * Requirements are checked against the user's completed AND in-progress courses.
 *
 * Course codes in the DB follow the format "SCHOOL DEPT NUMBER"
 * e.g. "CAS MA 121", "CDS DS 100", "CAS PY 211".
 * The `department` column stores just the dept code: "MA", "CS", "PY" etc.
 * BU language courses use department "LN" (all languages are under CAS LN).
 */

import { isCasLabCourse } from "./constants";

export interface SchoolRequirementStatus {
  id: string;
  name: string;
  description: string;
  /** Fully satisfied by at least one COMPLETED course */
  satisfied: boolean;
  /** Being worked on — satisfied only by an IN-PROGRESS course */
  inProgress: boolean;
  /** Human-readable status: course code, "In progress: …", or "Not satisfied" */
  current: string;
  target: string;
}

export type CourseEntry = {
  course: {
    code: string;
    title: string;
    department: string;
    credits: number;
    hasLab?: boolean;
  };
  status: "completed" | "in-progress";
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract the trailing course number from a code like "CAS MA 121" → 121 */
function courseNum(code: string): number {
  const parts = code.trim().split(/\s+/);
  return parseInt(parts[parts.length - 1], 10) || 0;
}

/** Find first course matching dept + any of the given course numbers (completed first) */
function findByDeptNum(
  courses: CourseEntry[],
  dept: string,
  nums: number[],
): CourseEntry | undefined {
  return (
    courses.find(
      (p) => p.status === "completed" && p.course.department === dept && nums.includes(courseNum(p.course.code)),
    ) ??
    courses.find(
      (p) => p.course.department === dept && nums.includes(courseNum(p.course.code)),
    )
  );
}

/** Find first course whose title matches a regex (completed first) */
function findByTitle(
  courses: CourseEntry[],
  pattern: RegExp,
): CourseEntry | undefined {
  return (
    courses.find((p) => p.status === "completed" && pattern.test(p.course.title)) ??
    courses.find((p) => pattern.test(p.course.title))
  );
}

/** Find first course matching a department set (completed first) */
function findByDepts(
  courses: CourseEntry[],
  depts: Set<string>,
): CourseEntry | undefined {
  return (
    courses.find((p) => p.status === "completed" && depts.has(p.course.department)) ??
    courses.find((p) => depts.has(p.course.department))
  );
}

/** Find first course matching a predicate (completed first) */
function findFirst(
  courses: CourseEntry[],
  pred: (p: CourseEntry) => boolean,
): CourseEntry | undefined {
  return (
    courses.find((p) => p.status === "completed" && pred(p)) ??
    courses.find((p) => pred(p))
  );
}

// ── Requirement builder ──────────────────────────────────────────────────────

function req(
  id: string,
  name: string,
  description: string,
  target: string,
  match: CourseEntry | undefined,
): SchoolRequirementStatus {
  const satisfied = match?.status === "completed";
  const inProgress = !!match && match.status === "in-progress";
  return {
    id,
    name,
    description,
    satisfied,
    inProgress,
    current: match
      ? inProgress
        ? `In progress: ${match.course.code}`
        : match.course.code
      : "Not satisfied",
    target,
  };
}

// ── School requirement sets ─────────────────────────────────────────────────────

// BU language department codes (all under CAS LN umbrella)
export const LANG_DEPTS = new Set([
  "LN",                                // CAS Languages umbrella code
  "FR", "IT", "LI", "SP", "GE", "JA", "CH", // French, Italian (LI=lit, IT=lang), Spanish, German, Japanese, Chinese
  "GK", "LA", "AR", "RU", "PO",       // Greek, Latin, Arabic, Russian, Portuguese
  "KO", "HB", "TU", "PL", "HI", "SW", // Korean, Hebrew, Turkish, Polish, Hindi, Swahili
  "CL",                                // Classical Studies (Greek/Latin)
  "NL", "SC", "TL",                   // Dutch/Scand, Scandinavian, Translation
]);
const LANG_TITLE = /\b(french|spanish|italian|german|japanese|chinese|mandarin|latin|greek|arabic|russian|portuguese|korean|hebrew|turkish|polish|hindi|swahili|sign\s*language)\b/i;

// LAB_DEPTS kept as a last-resort fallback for courses not yet in the official list
export const LAB_DEPTS = new Set(["BI", "CH", "PY", "ES", "EE", "NE"]);

/** CAS-wide base requirements shared by all CAS-affiliated programs */
function casBaseRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  // Language: use department codes first, then title as backup
  const lang = findByDepts(courses, LANG_DEPTS) ?? findByTitle(courses, LANG_TITLE);

  // Lab science: official CAS approved list first, then hasLab tag, then dept fallback
  const lab =
    findFirst(courses, (p) => isCasLabCourse(p.course.code)) ??
    findFirst(courses, (p) => p.course.hasLab === true) ??
    findByDepts(courses, LAB_DEPTS);

  // Writing: WR department, course number >= 100 (WR 100 First-Year Writing Seminar or WR 120+)
  const writing = findFirst(
    courses,
    (p) => p.course.department === "WR" && courseNum(p.course.code) >= 100,
  );

  return [
    req("cas-language", "Second Language", "4th-semester proficiency required — 4 semesters of a foreign language at BU, or AP 4-5 / IB HL 5-7 / SAT II 560+ exam credit", "LN/language dept course", lang),
    req("cas-lab", "Natural Sciences Lab", "One course from the official CAS approved lab list (AS 101/102/202/203/441, BI, CH, NE, PY, EE, AN, AR, BB, CC 111, PS 327-329, or similar)", "1 approved lab course", lab),
    req("cas-writing", "College Writing", "WR 100 (First-Year Writing Seminar) or WR 120+ — a writing course at the 100-level or above in the WR department", "WR 100+", writing),
  ];
}

/** CAS — College of Arts & Sciences */
function casRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  return casBaseRequirements(courses);
}

/** Pardee School — International Relations BA */
function pardeeIRRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  // IR 230 — required gateway course
  const ir230 =
    findByDeptNum(courses, "IR", [230]) ??
    findFirst(courses, (p) => p.course.department === "IR" && courseNum(p.course.code) >= 200 && courseNum(p.course.code) < 270);

  // IR 271 — International Political Economy
  const ir271 =
    findByDeptNum(courses, "IR", [271]) ??
    findFirst(courses, (p) => p.course.department === "IR" && courseNum(p.course.code) >= 270 && courseNum(p.course.code) < 300);

  // IR 395 — Theories of International Relations (required theory course)
  const theory =
    findByDeptNum(courses, "IR", [395, 540]) ??
    findFirst(courses, (p) => p.course.department === "IR" && courseNum(p.course.code) >= 350);

  // Quantitative methods: IR 348 or MA 213/214 or a stats/methods course by title
  const quant =
    findByDeptNum(courses, "IR", [348, 349]) ??
    findByDeptNum(courses, "MA", [213, 214]) ??
    findByTitle(courses, /\b(research\s+method|quantitative\s+method|statistics?)\b/i);

  // Upper-level IR courses (300+): need 3+ for regional + functional concentration
  const upperIR = courses.filter(
    (p) => p.course.department === "IR" && courseNum(p.course.code) >= 300,
  );
  const completedUpper = upperIR.filter((p) => p.status === "completed").length;
  const inProgressUpper = upperIR.filter((p) => p.status === "in-progress").length;
  const totalUpper = completedUpper + inProgressUpper;
  const upperReq: SchoolRequirementStatus = {
    id: "ir-upper-level",
    name: "Upper-Level IR (3 courses)",
    description: "3+ IR courses at 300-level covering regional specialization (e.g., IR 332 Middle East Politics) and functional area (e.g., IR 360 Int'l Security)",
    satisfied: completedUpper >= 3,
    inProgress: completedUpper < 3 && totalUpper > 0,
    current: totalUpper > 0 ? `${completedUpper} done, ${inProgressUpper} in progress` : "Not started",
    target: "3 IR 300+ courses",
  };

  // Senior seminar: IR 499 or any IR 490+
  const senior =
    findByDeptNum(courses, "IR", [499, 498]) ??
    findFirst(courses, (p) => p.course.department === "IR" && courseNum(p.course.code) >= 490);

  return [
    req("ir-intro",  "IR 230 — Intro to Int'l Relations", "IR 230 is the required gateway course for all Pardee IR majors", "IR 230", ir230),
    req("ir-ipe",    "IR 271 — Int'l Political Economy",  "IR 271 is required — covers economics and trade in global politics", "IR 271", ir271),
    req("ir-theory", "IR Theory (IR 395)",                "IR 395 (Theories of International Relations) — required theory component", "IR 395", theory),
    req("ir-quant",  "Quantitative Methods",              "IR 348 (Methods of Political Research) or MA 213/214 — required research methods", "IR 348 / MA 213", quant),
    upperReq,
    req("ir-senior", "Senior Seminar (IR 499)",           "IR 499 (Senior Seminar) — required capstone project", "IR 499", senior),
  ];
}

/** CDS — Faculty of Computing & Data Sciences */
function cdsRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const calc1 = findByDeptNum(courses, "MA", [121, 127]);
  const calc2 = findByDeptNum(courses, "MA", [122]);
  const calc3 = findByDeptNum(courses, "MA", [123]);
  const linalg = findByDeptNum(courses, "MA", [242]);
  const prog = findByDeptNum(courses, "CS", [101, 111, 112]);
  const stats =
    findByDeptNum(courses, "MA", [213, 214]) ??
    findFirst(courses, (p) => p.course.department === "DS" && courseNum(p.course.code) <= 200);
  const dsCore = findFirst(
    courses,
    (p) => p.course.department === "DS" && courseNum(p.course.code) >= 200,
  );

  return [
    req("cds-calc1", "Calculus I", "MA 121 or MA 127 (Calculus I or Applied Calculus)", "MA 121/127", calc1),
    req("cds-calc2", "Calculus II", "MA 122 (Calculus II)", "MA 122", calc2),
    req("cds-calc3", "Multivariable Calculus", "MA 123 (Multivariable Calculus)", "MA 123", calc3),
    req("cds-linalg", "Linear Algebra", "MA 242 (Linear Algebra) — core tool for ML and data analysis", "MA 242", linalg),
    req("cds-prog", "Intro to Programming", "CS 101 or CS 111 (Introduction to the Art and Science of Computing)", "CS 101/111", prog),
    req("cds-stats", "Probability & Statistics", "MA 213 or MA 214 (Probability Theory & Applications)", "MA 213/214", stats),
    req("cds-core", "CDS Core Course", "Any DS 200+ course (e.g. DS 340 Machine Learning, DS 380 Data Science)", "DS 200+", dsCore),
  ];
}

/** ENG — College of Engineering */
function engRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const calc1 = findByDeptNum(courses, "MA", [121, 127]);
  const calc2 = findByDeptNum(courses, "MA", [122]);
  const calc3 = findByDeptNum(courses, "MA", [123]);
  const phys1 = findByDeptNum(courses, "PY", [211, 251]);
  const phys2 = findByDeptNum(courses, "PY", [212, 252]);
  const chem = findByDeptNum(courses, "CH", [101, 102, 111, 112]);
  // Intro Engineering: EK 100, EK 125, EK 127, or BE 209
  const introEng = findByDeptNum(courses, "EK", [100, 125, 127, 128]) ??
    findByDeptNum(courses, "BE", [209]) ??
    findFirst(courses, (p) => p.course.department === "EK");

  return [
    req("eng-calc1", "Calculus I", "MA 121 (Calculus I) — required for all engineering programs", "MA 121", calc1),
    req("eng-calc2", "Calculus II", "MA 122 (Calculus II)", "MA 122", calc2),
    req("eng-calc3", "Multivariable Calculus", "MA 123 (Multivariable Calculus)", "MA 123", calc3),
    req("eng-phys1", "Physics I (Calculus-based)", "PY 211 or PY 251 (General Physics I with Calculus)", "PY 211/251", phys1),
    req("eng-phys2", "Physics II (Calculus-based)", "PY 212 or PY 252 (General Physics II)", "PY 212/252", phys2),
    req("eng-chem", "General Chemistry", "CH 101/102 or CH 111/112 (General Chemistry I/II)", "CH 101/111", chem),
    req("eng-intro", "Introduction to Engineering", "EK 100 (Intro to Engineering), EK 125, EK 127, or equivalent", "EK 100+", introEng),
  ];
}

/** COM — College of Communication */
function comRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const intro = findByDeptNum(courses, "CM", [180, 181, 182]) ??
    findFirst(courses, (p) => ["CM", "CO", "JO", "FT"].includes(p.course.department) && courseNum(p.course.code) <= 200);
  const research = findFirst(
    courses,
    (p) => p.course.department === "CM" &&
      courseNum(p.course.code) >= 200 &&
      courseNum(p.course.code) <= 230,
  );
  const upper = findFirst(
    courses,
    (p) => ["CM", "CO", "JO", "FT"].includes(p.course.department) && courseNum(p.course.code) >= 300,
  );

  return [
    req("com-intro", "Introduction to Communication", "CM 180 (Media, Culture & Society) or equivalent introductory COM course", "CM 180", intro),
    req("com-research", "Communication Research Methods", "A CM 200-level research methods course (e.g. CM 211)", "CM 200+", research),
    req("com-upper", "Upper-Level Concentration", "A 300+ course in your COM concentration (CM, CO, JO, or FT department)", "300+ course", upper),
  ];
}

/** SAR — Sargent College of Health & Rehabilitation Sciences */
function sarRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const bio1 = findByDeptNum(courses, "BI", [107, 108, 203]);
  const bio2 = findByDeptNum(courses, "BI", [108, 200, 203, 211]);
  const chem = findByDeptNum(courses, "CH", [101, 102, 111, 112]);
  const stats = findByDeptNum(courses, "MA", [113, 115, 213, 214]);
  const hsFoundation = findFirst(
    courses,
    (p) => p.course.department === "HS" && courseNum(p.course.code) <= 300,
  );

  return [
    req("sar-bio1", "Introductory Biology I", "BI 107 (Biology: Molecules, Cells, and Organisms)", "BI 107/108", bio1),
    req("sar-bio2", "Introductory Biology II", "BI 108 (Biology: From Cells to Organisms) or upper biology", "BI 108/200+", bio2),
    req("sar-chem", "General Chemistry", "CH 101/102 or CH 111/112 (General Chemistry)", "CH 101/111", chem),
    req("sar-stats", "Statistics", "MA 113 (Elementary Statistics) or MA 115 or MA 213", "MA 113/115", stats),
    req("sar-foundation", "SAR Foundation", "A foundational Health Sciences (HS) course", "HS course", hsFoundation),
  ];
}

/** QST — Questrom School of Business */
function qstRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const sm131 = findByDeptNum(courses, "SM", [131]);
  const calc = findByDeptNum(courses, "MA", [121, 122, 123, 124, 127]);
  const stats =
    findByDeptNum(courses, "MA", [113, 115, 213, 214]) ??
    findByTitle(courses, /\bstatistics?\b/i);

  return [
    req("qst-foundation", "Business, Markets & Society", "SM 131 (Business, Society & Ethics) — the Questrom core course", "SM 131", sm131),
    req("qst-calc", "Calculus", "MA 121 or MA 127 (Calculus I or Applied Calculus)", "MA 121/127", calc),
    req("qst-stats", "Statistics", "MA 213 or MA 115 (Statistics for Business)", "MA 213/115", stats),
  ];
}

/** SHA — School of Hospitality Administration */
function shaRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const hfCore = findFirst(
    courses,
    (p) => p.course.department === "HF" && courseNum(p.course.code) <= 250,
  );
  const stats = findByDeptNum(courses, "MA", [113, 115, 213]);

  return [
    req("sha-core", "Hospitality Foundation", "An introductory HF (Hospitality) course at HF 100-250 level", "HF core course", hfCore),
    req("sha-stats", "Statistics", "MA 113, MA 115, or equivalent statistics course", "MA 113/115", stats),
  ];
}

/** SPH — School of Public Health */
function sphRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const bio = findByDeptNum(courses, "BI", [107, 108]);
  const stats = findByDeptNum(courses, "MA", [113, 115, 213, 214]);
  const epi = findByTitle(courses, /\b(epidemiology|public\s+health)\b/i) ??
    findFirst(courses, (p) => p.course.department === "EP");

  return [
    req("sph-bio", "Biology", "BI 107 or BI 108 (Introductory Biology)", "BI 107/108", bio),
    req("sph-stats", "Statistics", "MA 113, MA 115, or MA 213 (Statistics)", "MA 113/115", stats),
    req("sph-epi", "Public Health or Epidemiology", "An introductory epidemiology or public health course (EP department or PH prefix)", "Epi/PH course", epi),
  ];
}

/** CFA — College of Fine Arts */
function cfaRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const MUSIC_DEPTS = new Set(["MH", "MT", "MP", "ME", "ML", "MU"]);
  const musicCore = findByDepts(courses, MUSIC_DEPTS);
  const theatre = findFirst(courses, (p) => p.course.department === "TH");
  const visualArts = findFirst(courses, (p) => ["VA", "DP", "SC", "PT"].includes(p.course.department));

  return [
    req("cfa-music", "Music Core", "A core music course: Music Theory (MT), History (MH), Performance (MP), Education (ME), or Music Literature (ML)", "Music course", musicCore),
    req("cfa-theatre", "Theatre Foundation", "A foundational Theatre (TH) course", "TH course", theatre),
    req("cfa-visual", "Visual Arts Foundation", "A Visual Arts (VA), Drawing (DP), Sculpture (SC), or Painting (PT) foundation course", "VA/DP/SC course", visualArts),
  ];
}

/** Wheelock — College of Education & Human Development */
function wheelockRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  const EDUC_DEPTS = new Set(["AP", "ED", "CI", "SEE", "EC"]);
  const edFoundation = findByDepts(courses, EDUC_DEPTS) ??
    findFirst(courses, (p) => p.course.department === "AP" && courseNum(p.course.code) <= 400);
  const devPsych = findByTitle(courses, /\b(developmental|child\s+development|human\s+development|adolescent)\b/i) ??
    findFirst(courses, (p) => p.course.department === "PS" && courseNum(p.course.code) >= 200);
  const stats = findByDeptNum(courses, "MA", [113, 115, 213]);

  return [
    req("wed-foundation", "Education Foundation", "An introductory Education or Applied Psychology (AP/ED/CI) course", "ED/AP course", edFoundation),
    req("wed-devpsych", "Developmental Psychology", "A course in developmental, child, or human development psychology", "Dev. Psychology", devPsych),
    req("wed-stats", "Statistics", "MA 113, MA 115, or equivalent statistics course", "MA 113/115", stats),
  ];
}

/** SSW — School of Social Work */
function sswRequirements(courses: CourseEntry[]): SchoolRequirementStatus[] {
  // SW intro: SW 100 or any SW 100-199 foundation course
  const swIntro = findByDeptNum(courses, "SW", [100, 101, 110]) ??
    findFirst(courses, (p) => p.course.department === "SW" && courseNum(p.course.code) < 200);

  // Human Behavior in the Social Environment (HBSE): SW 201 / SW 202
  const hbse = findByDeptNum(courses, "SW", [201, 202]) ??
    findByTitle(courses, /\bhuman\s+behavior\b/i);

  // Social welfare policy: SW 301 or policy course
  const policy = findByDeptNum(courses, "SW", [301, 302]) ??
    findByTitle(courses, /\b(social\s+welfare\s+policy|social\s+policy)\b/i);

  // Social work practice: SW 310 / SW 311
  const practice = findByDeptNum(courses, "SW", [310, 311, 320]) ??
    findByTitle(courses, /\bsocial\s+work\s+practice\b/i);

  // Research methods: SW 610 / SW 505 or stats course
  const research = findByDeptNum(courses, "SW", [505, 610]) ??
    findByDeptNum(courses, "MA", [113, 115, 213, 214]) ??
    findByTitle(courses, /\b(social\s+work\s+research|research\s+method|statistics?)\b/i);

  // Field practicum: SW 400+ field education
  const fieldPracticum = findFirst(
    courses,
    (p) => p.course.department === "SW" && courseNum(p.course.code) >= 400,
  ) ?? findByTitle(courses, /\bfield\s+(practicum|education|placement|internship)\b/i);

  return [
    req("ssw-intro",     "Introduction to Social Work",         "SW 100 or equivalent introductory social work course", "SW 100", swIntro),
    req("ssw-hbse",      "Human Behavior & Social Environment", "SW 201/202 — required HBSE sequence", "SW 201/202", hbse),
    req("ssw-policy",    "Social Welfare Policy",               "SW 301 — Social Welfare Policy and Services", "SW 301", policy),
    req("ssw-practice",  "Social Work Practice",                "SW 310/311 — Generalist Social Work Practice sequence", "SW 310/311", practice),
    req("ssw-research",  "Research Methods / Statistics",       "SW 505/610 or MA 113/213 — required research methods or statistics", "SW 505 / MA 213", research),
    req("ssw-practicum", "Field Practicum",                     "SW 400+ field education — required supervised practice placement", "SW 400+ field", fieldPracticum),
  ];
}

// ── Main entry point ────────────────────────────────────────────────────────────

/**
 * Compute graduation requirements for a user based on their active programs.
 * `courses` should include both completed AND in-progress courses, each with a `status` field.
 */
export function computeSchoolRequirements(
  activePrograms: { code: string; type: string }[],
  courses: CourseEntry[],
  totalCreditsEarned: number,
  totalCreditsInProgress: number,
  gpa: number,
  creditsRequired = 128,
): SchoolRequirementStatus[] {
  const universal: SchoolRequirementStatus[] = [
    {
      id: "credits",
      name: "Total Credits",
      description: `${creditsRequired} credits required for graduation`,
      satisfied: totalCreditsEarned >= creditsRequired,
      inProgress: totalCreditsEarned < creditsRequired && (totalCreditsEarned + totalCreditsInProgress) >= creditsRequired,
      current: `${totalCreditsEarned} earned${totalCreditsInProgress > 0 ? ` + ${totalCreditsInProgress} IP` : ""}`,
      target: `${creditsRequired}`,
    },
    {
      id: "gpa",
      name: "Minimum GPA",
      description: creditsRequired >= 144
        ? "2.0 minimum in each degree at graduation; 3.0 GPA required to apply to Dual Degree Program"
        : "2.0 cumulative GPA required",
      satisfied: gpa >= 2.0,
      inProgress: false,
      current: gpa > 0 ? gpa.toFixed(3) : "No grades yet",
      target: "2.0",
    },
  ];

  // Use the first active major to determine school
  const activeMajor =
    activePrograms.find((p) => p.type === "major") ??
    activePrograms.find((p) => p.type === "joint-major") ??
    activePrograms[0];

  if (!activeMajor) return universal;

  const code = activeMajor.code;
  let schoolSpecific: SchoolRequirementStatus[] = [];

  if (code === "cas-intl-relations-ba") {
    schoolSpecific = pardeeIRRequirements(courses);
  } else if (code.startsWith("cas-") || code === "cs-ba") {
    // cas-* covers all CAS majors; cs-ba is a legacy CAS CS code
    schoolSpecific = casRequirements(courses);
  } else if (code.startsWith("cds-")) {
    schoolSpecific = cdsRequirements(courses);
  } else if (code.startsWith("eng-")) {
    schoolSpecific = engRequirements(courses);
  } else if (code.startsWith("com-")) {
    schoolSpecific = comRequirements(courses);
  } else if (code.startsWith("sar-")) {
    schoolSpecific = sarRequirements(courses);
  } else if (code.startsWith("sha-")) {
    schoolSpecific = shaRequirements(courses);
  } else if (code.startsWith("sph-")) {
    schoolSpecific = sphRequirements(courses);
  } else if (code.startsWith("ssw-")) {
    schoolSpecific = sswRequirements(courses);
  } else if (code.startsWith("cfa-")) {
    schoolSpecific = cfaRequirements(courses);
  } else if (code.startsWith("wheelock-")) {
    schoolSpecific = wheelockRequirements(courses);
  } else if (code.startsWith("qst-")) {
    schoolSpecific = qstRequirements(courses);
  } else if (code.startsWith("joint-")) {
    // Joint majors: route to the relevant school's requirements.
    // joint-qst-business is Questrom-based; all others are CAS-based.
    if (code === "joint-qst-business") {
      schoolSpecific = qstRequirements(courses);
    } else {
      // joint-cs-economics, joint-cs-math, joint-cs-linguistics, joint-cs-music,
      // joint-math-economics, joint-math-philosophy, joint-math-stats,
      // joint-physics-math, joint-history-pols, joint-neuro-psych, etc.
      schoolSpecific = casRequirements(courses);
    }
  }
  // minor-* and any unrecognised code: return only universal requirements

  return [...universal, ...schoolSpecific];
}

/**
 * Compute school-specific requirements for a SINGLE program (no universal Credits/GPA rows).
 * Used to populate per-program schoolRequirements on ProgramProgress.
 */
export function computeProgramSchoolRequirements(
  programCode: string,
  courses: CourseEntry[],
): SchoolRequirementStatus[] {
  if (programCode === "cas-intl-relations-ba") return pardeeIRRequirements(courses);
  if (programCode.startsWith("cas-") || programCode === "cs-ba") return casRequirements(courses);
  if (programCode.startsWith("cds-")) return cdsRequirements(courses);
  if (programCode.startsWith("eng-")) return engRequirements(courses);
  if (programCode.startsWith("com-")) return comRequirements(courses);
  if (programCode.startsWith("sar-")) return sarRequirements(courses);
  if (programCode.startsWith("sha-")) return shaRequirements(courses);
  if (programCode.startsWith("sph-")) return sphRequirements(courses);
  if (programCode.startsWith("ssw-")) return sswRequirements(courses);
  if (programCode.startsWith("cfa-")) return cfaRequirements(courses);
  if (programCode.startsWith("wheelock-")) return wheelockRequirements(courses);
  if (programCode.startsWith("qst-")) return qstRequirements(courses);
  if (programCode.startsWith("joint-")) {
    return programCode === "joint-qst-business"
      ? qstRequirements(courses)
      : casRequirements(courses);
  }
  return []; // minors and unrecognised codes
}

// ── Planner-facing helpers ──────────────────────────────────────────────────

export { courseNum };

/**
 * A search criterion the planner uses to find courses satisfying an unsatisfied
 * school-specific requirement. Each criterion represents one DB query strategy.
 */
export interface SchoolReqSearchCriterion {
  reqId: string;
  reqName: string;
  /** Department codes to search for candidate courses */
  departments?: string[];
  /** Specific course numbers within those departments */
  courseNumbers?: number[];
  /** Minimum course number (e.g. 100 for WR 100+) */
  minCourseNum?: number;
}

/**
 * Returns search criteria for school-specific requirements that are NOT yet
 * satisfied by the user's completed/in-progress courses.
 *
 * The planner uses these criteria to query the DB for candidate courses,
 * then adds them to the plan.
 */
export function getUnsatisfiedSchoolReqCriteria(
  programCode: string,
  courses: CourseEntry[],
): SchoolReqSearchCriterion[] {
  const reqs = computeProgramSchoolRequirements(programCode, courses);
  const unsatisfied = reqs.filter((r) => !r.satisfied && !r.inProgress);
  if (unsatisfied.length === 0) return [];

  const criteria: SchoolReqSearchCriterion[] = [];

  for (const r of unsatisfied) {
    switch (r.id) {
      // CAS
      case "cas-language":
        criteria.push({ reqId: r.id, reqName: r.name, departments: [...LANG_DEPTS] });
        break;
      case "cas-lab":
        criteria.push({ reqId: r.id, reqName: r.name, departments: [...LAB_DEPTS, "AS", "AN", "BB"] });
        break;
      case "cas-writing":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["WR"], minCourseNum: 100 });
        break;

      // CDS
      case "cds-calc1":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [121, 127] });
        break;
      case "cds-calc2":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [122] });
        break;
      case "cds-calc3":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [123] });
        break;
      case "cds-linalg":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [242] });
        break;
      case "cds-prog":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CS"], courseNumbers: [101, 111, 112] });
        break;
      case "cds-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [213, 214] });
        break;
      case "cds-core":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["DS"], minCourseNum: 200 });
        break;

      // ENG
      case "eng-calc1":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [121] });
        break;
      case "eng-calc2":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [122] });
        break;
      case "eng-calc3":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [123] });
        break;
      case "eng-phys1":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["PY"], courseNumbers: [211, 251] });
        break;
      case "eng-phys2":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["PY"], courseNumbers: [212, 252] });
        break;
      case "eng-chem":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CH"], courseNumbers: [101, 102, 111, 112] });
        break;
      case "eng-intro":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["EK"], courseNumbers: [100, 125, 127, 128] });
        break;

      // COM
      case "com-intro":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CM"], courseNumbers: [180, 181, 182] });
        break;
      case "com-research":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CM"], minCourseNum: 200 });
        break;
      case "com-upper":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CM", "CO", "JO", "FT"], minCourseNum: 300 });
        break;

      // SAR
      case "sar-bio1":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["BI"], courseNumbers: [107, 108, 203] });
        break;
      case "sar-bio2":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["BI"], courseNumbers: [108, 200, 203, 211] });
        break;
      case "sar-chem":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["CH"], courseNumbers: [101, 102, 111, 112] });
        break;
      case "sar-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [113, 115, 213, 214] });
        break;
      case "sar-foundation":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["HS"], minCourseNum: 100 });
        break;

      // QST
      case "qst-foundation":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SM"], courseNumbers: [131] });
        break;
      case "qst-calc":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [121, 122, 123, 124, 127] });
        break;
      case "qst-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [113, 115, 213, 214] });
        break;

      // SHA
      case "sha-core":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["HF"], minCourseNum: 100 });
        break;
      case "sha-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [113, 115, 213] });
        break;

      // SPH
      case "sph-bio":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["BI"], courseNumbers: [107, 108] });
        break;
      case "sph-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [113, 115, 213, 214] });
        break;
      case "sph-epi":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["EP"], minCourseNum: 100 });
        break;

      // CFA
      case "cfa-music":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MH", "MT", "MP", "ME", "ML", "MU"] });
        break;
      case "cfa-theatre":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["TH"] });
        break;
      case "cfa-visual":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["VA", "DP", "SC", "PT"] });
        break;

      // Wheelock
      case "wed-foundation":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["AP", "ED", "CI", "SEE", "EC"] });
        break;
      case "wed-devpsych":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["PS"], minCourseNum: 200 });
        break;
      case "wed-stats":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["MA"], courseNumbers: [113, 115, 213] });
        break;

      // SSW
      case "ssw-intro":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], courseNumbers: [100, 101, 110] });
        break;
      case "ssw-hbse":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], courseNumbers: [201, 202] });
        break;
      case "ssw-policy":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], courseNumbers: [301, 302] });
        break;
      case "ssw-practice":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], courseNumbers: [310, 311, 320] });
        break;
      case "ssw-research":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], courseNumbers: [505, 610] });
        break;
      case "ssw-practicum":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["SW"], minCourseNum: 400 });
        break;

      // Pardee IR
      case "ir-intro":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR"], courseNumbers: [230] });
        break;
      case "ir-ipe":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR"], courseNumbers: [271] });
        break;
      case "ir-theory":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR"], courseNumbers: [395, 540] });
        break;
      case "ir-quant":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR", "MA"], courseNumbers: [348, 349, 213, 214] });
        break;
      case "ir-upper-level":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR"], minCourseNum: 300 });
        break;
      case "ir-senior":
        criteria.push({ reqId: r.id, reqName: r.name, departments: ["IR"], courseNumbers: [498, 499] });
        break;
    }
  }

  return criteria;
}
