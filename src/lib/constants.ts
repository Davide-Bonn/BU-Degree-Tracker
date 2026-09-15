// BU Hub Learning Outcome Areas grouped by Capacity
// Reference: https://www.bu.edu/hub/

export interface HubAreaDef {
  code: string;
  name: string;
  capacity: string;
  unitsRequired: number;
}

export const HUB_CAPACITIES = [
  "Philosophical, Aesthetic, and Historical Interpretation",
  "Scientific and Social Inquiry",
  "Quantitative Reasoning",
  "Diversity, Civic Engagement, and Global Citizenship",
  "Communication",
  "Intellectual Toolkit",
] as const;

export const HUB_AREAS: HubAreaDef[] = [
  // Philosophical, Aesthetic, and Historical Interpretation
  { code: "PHI1", name: "Philosophical Inquiry and Life's Meanings", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },
  { code: "PHI2", name: "Aesthetic Exploration", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },
  { code: "PHI3", name: "Historical Consciousness", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },

  // Scientific and Social Inquiry — each area needs 1 course (3 courses total: SCI1 + SOC1 + one of SCI2/SOC2)
  { code: "SCI1", name: "Scientific Inquiry I", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SCI2", name: "Scientific Inquiry II", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SOC1", name: "Social Inquiry I", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SOC2", name: "Social Inquiry II", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },

  // Quantitative Reasoning — each needs 1 course
  { code: "QR1", name: "Quantitative Reasoning I", capacity: "Quantitative Reasoning", unitsRequired: 1 },
  { code: "QR2", name: "Quantitative Reasoning II", capacity: "Quantitative Reasoning", unitsRequired: 1 },

  // Diversity, Civic Engagement, and Global Citizenship
  { code: "DIV1", name: "The Individual in Community", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 1 },
  { code: "DIV2", name: "Global Citizenship and Intercultural Literacy", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 2 }, // 2 separate courses required
  { code: "CIV1", name: "Ethical Reasoning", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 1 },

  // Communication
  { code: "COM1", name: "First-Year Writing Seminar", capacity: "Communication", unitsRequired: 1 },
  { code: "COM2", name: "Writing, Research, and Inquiry", capacity: "Communication", unitsRequired: 1 },
  { code: "COM3", name: "Oral and/or Signed Communication", capacity: "Communication", unitsRequired: 1 },
  { code: "COM4", name: "Digital/Multimedia Expression", capacity: "Communication", unitsRequired: 1 },
  { code: "WIC", name: "Writing-Intensive Course", capacity: "Communication", unitsRequired: 2 }, // 2 separate WIC courses required

  // Intellectual Toolkit
  { code: "ITK1", name: "Teamwork/Collaboration", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK2", name: "Research and Information Literacy", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK3", name: "Creativity/Innovation", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK4", name: "Critical Thinking", capacity: "Intellectual Toolkit", unitsRequired: 2 },
];

// Total Hub units required: sum of all unitsRequired
export const TOTAL_HUB_UNITS_REQUIRED = HUB_AREAS.reduce((sum, a) => sum + a.unitsRequired, 0);

// Grade points for GPA calculation
export const GRADE_POINTS: Record<string, number> = {
  "A": 4.0,
  "A-": 3.7,
  "B+": 3.3,
  "B": 3.0,
  "B-": 2.7,
  "C+": 2.3,
  "C": 2.0,
  "C-": 1.7,
  "D+": 1.3,
  "D": 1.0,
  "D-": 0.7,
  "F": 0.0,
};

// CAS BA General Requirements
export interface CASRequirement {
  id: string;
  name: string;
  description: string;
}

export const CAS_REQUIREMENTS: CASRequirement[] = [
  { id: "credits", name: "Total Credits", description: "128 credits required for graduation" },
  { id: "gpa", name: "Minimum GPA", description: "2.0 cumulative GPA required" },
  { id: "language", name: "Second Language", description: "Satisfied by IELTS or equivalent" },
  { id: "lab", name: "Natural Sciences Lab", description: "At least one lab science course" },
];

export const TOTAL_CREDITS_REQUIRED = 128;
export const MIN_GPA_REQUIRED = 2.0;

export function schoolForProgramCode(code: string): string {
  if (code === "cas-intl-relations-ba") return "pardee";
  if (code.startsWith("cas-") || code === "cs-ba") return "cas";
  if (code.startsWith("cds-")) return "cds";
  if (code.startsWith("eng-")) return "eng";
  if (code.startsWith("com-")) return "com";
  if (code.startsWith("sar-")) return "sar";
  if (code.startsWith("sha-")) return "sha";
  if (code.startsWith("sph-")) return "sph";
  if (code.startsWith("ssw-")) return "ssw";
  if (code.startsWith("cfa-")) return "cfa";
  if (code.startsWith("wheelock-")) return "wheelock";
  if (code.startsWith("qst-")) return "qst";
  return "other";
}

export type DegreeType = "single" | "double-major" | "dual-degree";

/** Minimum total credits by school for a single degree. */
const SCHOOL_BASE_CREDITS: Record<string, number> = {
  eng: 130,  // ENG programs range 131–135 by specific program; 130 is the safe floor
  qst: 133,  // BSBA is always 133 credits
  // All other schools default to 128
};

function baseCreditsForSchool(school: string): number {
  return SCHOOL_BASE_CREDITS[school] ?? 128;
}

/**
 * BU credit rules:
 * - 1 major                  → school floor (128 CAS/most; 130 ENG floor; 133 QST)
 * - 2+ majors, same school   → school floor, except ENG double major → 160
 * - 2+ majors, diff schools  → 144 credits (dual degree, two separate bachelor's)
 */
export function computeCreditsRequired(
  activeMajors: { code: string }[],
): { credits: number; degreeType: DegreeType } {
  if (activeMajors.length === 0) return { credits: 128, degreeType: "single" };

  if (activeMajors.length === 1) {
    const school = schoolForProgramCode(activeMajors[0].code);
    return { credits: baseCreditsForSchool(school), degreeType: "single" };
  }

  const schools = new Set(activeMajors.map((m) => schoolForProgramCode(m.code)));

  // Different colleges → dual degree (two separate bachelor's), 144 minimum
  if (schools.size >= 2) return { credits: 144, degreeType: "dual-degree" };

  // Same college double major
  const school = [...schools][0];
  // ENG double major explicitly requires 160 credits per BU policy
  const credits = school === "eng" ? 160 : baseCreditsForSchool(school);
  return { credits, degreeType: "double-major" };
}

export const TOTAL_CS_COURSES_REQUIRED = 45;
export const CALCULUS_REQUIREMENT = "MATH 121";

/**
 * Official CAS Natural Sciences Laboratory approved course list.
 * Source: https://www.bu.edu/academics/cas/programs/natural-sciences-laboratory-requirement/
 *
 * Keys are BU department codes; values are the approved course numbers within that dept.
 * Note: EE = Earth & Environment (previously catalogued as ES by some systems).
 */
export const CAS_LAB_COURSES: Record<string, ReadonlyArray<number>> = {
  AN: [102, 550, 595],
  AR: [307],
  AS: [101, 102, 202, 203, 441],
  BB: [421, 422, 522, 527, 528],
  BI: [105, 107, 108, 114, 116, 210, 211, 218, 281, 302, 303, 305, 306,
       310, 311, 315, 407, 421, 422, 445, 449, 513, 527, 528, 561],
  CH: [101, 102, 109, 110, 111, 112, 116, 131, 171, 172, 174, 181, 182,
       201, 203, 204, 211, 212, 214, 218, 220, 232, 301, 303, 354, 421, 422, 527],
  CC: [111],
  EE: [101, 105, 107, 300, 305, 317, 542, 543, 544, 557, 562, 591],
  ES: [101, 105, 107, 300, 305, 317, 542, 543, 544, 557, 562, 591], // alias for EE (older dept code)
  NE: [102, 116, 203, 218, 323, 327, 328, 329, 445, 449, 561],
  PS: [327, 328, 329],
  PY: [104, 105, 106, 107, 211, 212, 241, 242, 251, 252, 313, 351, 371, 581],
};

/** Returns true if the given BU course code is on the official CAS lab approved list. */
export function isCasLabCourse(code: string): boolean {
  const parts = code.trim().split(/\s+/);
  // Format: "CAS AS 101" → dept="AS", num=101
  if (parts.length < 2) return false;
  const dept = parts[parts.length - 2].toUpperCase();
  const num  = parseInt(parts[parts.length - 1], 10);
  if (isNaN(num)) return false;
  return (CAS_LAB_COURSES[dept] ?? []).includes(num);
}

// Distinct color per hub capacity (hex)
export const CAPACITY_COLORS: Record<string, string> = {
  "Philosophical, Aesthetic, and Historical Interpretation": "#7c3aed",
  "Scientific and Social Inquiry": "#0891b2",
  "Quantitative Reasoning": "#2563eb",
  "Diversity, Civic Engagement, and Global Citizenship": "#d97706",
  "Communication": "#db2777",
  "Intellectual Toolkit": "#059669",
};
