/**
 * Parses prerequisite text into structured AND/OR groups.
 *
 * Handles all BU schools and department codes, including:
 *   "CAS CS 112 and CAS CS 131"
 *   "CASCS112 and CASCS131"
 *   "CAS CS112; CAS CS131"
 *   "ENG EK 127 or ENG EK 128"
 *   "CAS CS 132/MA 242 or CAS CS 235/MA 294"   (cross-listed slash = OR)
 *   "(CAS CS 132 or CAS CS 235)"
 *   "one of the following: ..."
 */

export interface PrereqGroup {
  groupId: number;
  type: "AND" | "OR";
  courses: string[]; // normalized codes like "CAS CS 112", "ENG EK 127"
}

// ── School / dept lookup ───────────────────────────────────────────────────────

/** Maps bare dept code → BU school prefix for the standard "SCHOOL DEPT NUM" format. */
const DEPT_TO_SCHOOL: Record<string, string> = {
  // CAS – College of Arts & Sciences
  CS: "CAS", MA: "CAS", EC: "CAS", EN: "CAS", WR: "CAS",
  BI: "CAS", CH: "CAS", PY: "CAS", HI: "CAS", PH: "CAS",
  PS: "CAS", SO: "CAS", AN: "CAS", NE: "CAS", AR: "CAS",
  GE: "CAS", LS: "CAS", LF: "CAS", LG: "CAS",
  // ENG – College of Engineering
  EK: "ENG", ME: "ENG", BE: "ENG", SE: "ENG", MS: "ENG",
  // ECE is 3 letters — handled below
  // CDS – Faculty of Computing & Data Sciences
  DS: "CDS",
  // QST – Questrom School of Business
  SM: "QST", FE: "QST", MK: "QST", OB: "QST", SI: "QST",
  // COM – College of Communication
  CM: "COM", PR: "COM", FT: "COM", JO: "COM",
  // SAR – Sargent College
  HP: "SAR", DO: "SAR", PT: "SAR", OT: "SAR",
  // SHA – School of Hospitality Administration
  HF: "SHA",
  // SPH – School of Public Health
  EP: "SPH", BB: "SPH", PH2: "SPH",
  // SSW – School of Social Work
  SW: "SSW",
  // MET – Metropolitan College
  AD: "MET", CS2: "MET",
  // CFA – College of Fine Arts
  TH: "CFA", MU: "CFA",
};

/** 3-letter dept codes (to handle ECE, etc.) */
const DEPT3_TO_SCHOOL: Record<string, string> = {
  ECE: "ENG",
  MSE: "ENG",
  BME: "ENG",
};

/** All known BU school abbreviations (as they appear in prerequisite text). */
const KNOWN_SCHOOLS = new Set([
  "CAS", "ENG", "QST", "COM", "SAR", "SHA", "SPH", "SSW",
  "STH", "MET", "CFA", "CGS", "WED", "LAW", "GRS", "CDS",
]);

// ── Code extraction ───────────────────────────────────────────────────────────

/**
 * Convert raw matched parts into a canonical "SCHOOL DEPT NUM" code.
 * Returns null if the school cannot be determined.
 */
function toCanonical(school: string | null, dept: string, num: string): string | null {
  dept = dept.toUpperCase();
  num  = num.toUpperCase();

  if (school) {
    school = school.toUpperCase();
    if (KNOWN_SCHOOLS.has(school)) return `${school} ${dept} ${num}`;
  }

  // 3-letter dept
  const s3 = DEPT3_TO_SCHOOL[dept];
  if (s3) return `${s3} ${dept} ${num}`;

  // 2-letter dept
  const s2 = DEPT_TO_SCHOOL[dept];
  if (s2) return `${s2} ${dept} ${num}`;

  return null;
}

/** Build a combined school-alternation string for regex use. */
const SCHOOL_ALT = [...KNOWN_SCHOOLS].join("|");

/**
 * Extract all recognised BU course codes from a text segment.
 * Returns deduplicated canonical codes.
 */
function extractCourseCodes(text: string): string[] {
  // Pre-process: treat "/" between codes as " or " (cross-listed courses)
  text = text.replace(/\//g, " or ");

  const seen  = new Set<string>();
  const codes: string[] = [];

  function add(code: string | null) {
    if (code && !seen.has(code)) { seen.add(code); codes.push(code); }
  }

  // ── Pattern 1: explicit school prefix (condensed or spaced) ─────────────
  // Matches: CASCS112, CASCS 112, CAS CS112, CAS CS 112, ENG EK 301, ENGEK127, …
  const fullRe = new RegExp(
    `\\b(${SCHOOL_ALT})\\s*([A-Z]{2,3})\\s*(\\d{3}[A-Z0-9]*)\\b`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = fullRe.exec(text)) !== null) {
    add(toCanonical(m[1], m[2], m[3]));
  }

  // ── Pattern 2: bare dept+num for known dept codes ────────────────────────
  // Matches: CS 112, MA 225, EK 127, DS 340, ECE 302, …
  const allDepts = [
    ...Object.keys(DEPT_TO_SCHOOL),
    ...Object.keys(DEPT3_TO_SCHOOL),
  ];
  const deptAlt = allDepts
    .sort((a, b) => b.length - a.length) // longer first so ECE > EC
    .join("|");
  const bareRe = new RegExp(
    `\\b(${deptAlt})\\s*(\\d{3}[A-Z0-9]*)\\b`,
    "gi"
  );
  while ((m = bareRe.exec(text)) !== null) {
    add(toCanonical(null, m[1], m[2]));
  }

  return codes;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parsePrerequisites(text: string): PrereqGroup[] {
  if (!text || !text.trim()) return [];

  const groups: PrereqGroup[] = [];
  let groupId = 0;

  // ── Case 1: "one of the following: X or Y or Z" ─────────────────────────
  const oneOfMatch = text.match(
    /(.*?)(?:and\s+)?one\s+of\s+the\s+following:\s*(.*)/i
  );
  if (oneOfMatch) {
    const andPart = oneOfMatch[1].trim();
    const orPart  = oneOfMatch[2].trim();

    const andCodes = extractCourseCodes(andPart);
    if (andCodes.length > 0) {
      groups.push({ groupId: groupId++, type: "AND", courses: andCodes });
    }

    const orCodes = extractCourseCodes(orPart);
    if (orCodes.length > 0) {
      groups.push({ groupId: groupId++, type: "OR", courses: [...new Set(orCodes)] });
    }
    return groups;
  }

  // ── Case 2: general AND / OR logic ──────────────────────────────────────
  const hasOr  = /\bor\b/i.test(text);
  const hasAnd = /\band\b|\bwith\b/i.test(text) || /;\s*/.test(text);

  if (hasOr && !hasAnd) {
    // Pure OR
    const codes = extractCourseCodes(text);
    if (codes.length > 0) {
      groups.push({ groupId: groupId++, type: "OR", courses: [...new Set(codes)] });
    }
  } else if (hasAnd) {
    // Split by AND/semicolon; each segment may itself be an OR group
    const parts = text.split(/\s+and\s+|\s+with\s+|;\s*/i);
    const andCodes: string[] = [];

    for (const part of parts) {
      if (/\bor\b/i.test(part)) {
        const orCodes = extractCourseCodes(part);
        if (orCodes.length > 0) {
          groups.push({
            groupId: groupId++,
            type: "OR",
            courses: [...new Set(orCodes)],
          });
        }
      } else {
        andCodes.push(...extractCourseCodes(part));
      }
    }

    if (andCodes.length > 0) {
      groups.push({ groupId: groupId++, type: "AND", courses: andCodes });
    }
  } else {
    // Simple list (no connectors)
    const codes = extractCourseCodes(text);
    if (codes.length > 0) {
      groups.push({ groupId: groupId++, type: "AND", courses: codes });
    }
  }

  return groups;
}
