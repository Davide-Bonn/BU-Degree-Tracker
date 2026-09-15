// Client-side only — imported dynamically from event handlers only.
// Do NOT import this file at the top level of any server component.

import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannerExportData {
  v: number;
  exportDate: string;
  courses: {
    code: string;
    status: string;
    semester: string;
    grade: string;
  }[];
}

interface ExportCourse {
  id: number;
  code: string;
  title: string;
  credits: number;
  status: string | null;
  semester: string | null;
  grade: string | null;
  hubAreas: { code: string; name: string }[];
}

interface ExportProgress {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsRequired: number;
  gpa: number;
  hubCapacities: {
    capacity: string;
    unitsFulfilled: number;
    unitsRequired: number;
    areas: {
      code: string;
      name: string;
      unitsFulfilled: number;
      unitsRequired: number;
    }[];
  }[];
  programs: {
    name: string;
    isActive: boolean;
    totalCompleted: number;
    totalRequired: number;
    schoolRequirements?: {
      name: string;
      satisfied: boolean;
      inProgress: boolean;
      current: string;
      target: string;
    }[];
  }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_PREFIX = "BU_PLANNER_V1:";

// Color palette for status types (RGB tuples)
const STATUS_COLORS = {
  completed:   { bg: [220, 245, 220] as const, text: [30, 120, 30] as const,  label: "Completed" },
  "in-progress": { bg: [220, 235, 255] as const, text: [30, 80, 170] as const,  label: "In Progress" },
  planned:     { bg: [255, 240, 215] as const, text: [160, 90, 0] as const,   label: "Planned" },
  unplanned:   { bg: [240, 240, 240] as const, text: [110, 110, 110] as const, label: "Interested" },
} as const;

type StatusKey = keyof typeof STATUS_COLORS;

function getStatusKey(status: string | null, isPlaced: boolean): StatusKey {
  if (status === "completed") return "completed";
  if (status === "in-progress") return "in-progress";
  if (status === "planned" && isPlaced) return "planned";
  return "unplanned";
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportPlannerPdf(
  allCourses: ExportCourse[],
  assignments: Map<number, string>,
  semesters: string[],
  progress: ExportProgress,
  plannedCredits: number
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  function checkPage(needed = 8) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function hr(gray = 200) {
    doc.setDrawColor(gray);
    doc.line(margin, y, pageW - margin, y);
    doc.setDrawColor(0);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("BU Degree Planner", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130);
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  doc.text(`Exported ${dateStr}`, pageW - margin, y, { align: "right" });
  doc.setTextColor(0);

  y += 5;
  hr();
  y += 6;

  // ── Color legend ────────────────────────────────────────────────────────
  const legendItems: { key: StatusKey; label: string }[] = [
    { key: "completed",    label: "Completed" },
    { key: "in-progress",  label: "In Progress" },
    { key: "planned",      label: "Planned (assigned to semester)" },
    { key: "unplanned",    label: "Interested (not yet scheduled)" },
  ];
  doc.setFontSize(7);
  let lx = margin;
  for (const item of legendItems) {
    const colors = STATUS_COLORS[item.key];
    doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
    doc.roundedRect(lx, y - 2.5, 3, 3, 0.5, 0.5, "F");
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.setFont("helvetica", "bold");
    doc.text(item.label, lx + 4, y);
    lx += doc.getTextWidth(item.label) + 8;
  }
  doc.setTextColor(0);
  y += 5;
  hr();
  y += 6;

  // ── Stats row ─────────────────────────────────────────────────────────────
  const stats: [string, string][] = [
    ["Credits Earned",  `${progress.totalCreditsEarned} cr`],
    ["In Progress",     `${progress.totalCreditsInProgress} cr`],
    ["Planned",         `${plannedCredits} cr`],
    ["Required",        `${progress.totalCreditsRequired} cr`],
    ["GPA",             progress.gpa.toFixed(2)],
  ];
  const sw = (pageW - 2 * margin) / stats.length;
  for (let i = 0; i < stats.length; i++) {
    const [label, val] = stats[i];
    const x = margin + i * sw;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(val, x, y + 5);
  }
  y += 13;
  hr();
  y += 6;

  // ── Semester Plan ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Semester Plan", margin, y);
  y += 7;

  // Column layout (A4 portrait, 182mm usable)
  const COL_X = {
    code:   margin + 1,
    title:  margin + 30,
    cr:     margin + 104,
    hubs:   margin + 113,
    status: margin + 155,
  };
  const COL_W = {
    code:   28,
    title:  73,
    cr:     9,
    hubs:   41,
    status: 27,
  };
  const rowW = pageW - 2 * margin;

  function tableHeader() {
    doc.setFillColor(60, 60, 60);
    doc.rect(margin, y - 3.5, rowW, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255);
    doc.text("CODE",      COL_X.code,   y);
    doc.text("TITLE",     COL_X.title,  y);
    doc.text("CR",        COL_X.cr,     y);
    doc.text("HUB AREAS", COL_X.hubs,   y);
    doc.text("STATUS",    COL_X.status, y);
    doc.setTextColor(0);
    y += 3;
    y += 3;
  }

  function courseRow(c: ExportCourse, statusKey: StatusKey, gradeStr?: string) {
    checkPage(7);
    const colors = STATUS_COLORS[statusKey];
    const rowH = 5;

    // Colored row background
    doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
    doc.rect(margin, y - 3.2, rowW, rowH, "F");

    // Course code (bold, in status color)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(c.code, COL_X.code, y, { maxWidth: COL_W.code });

    // Title
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    const shortTitle = c.title.length > 42 ? c.title.slice(0, 39) + "\u2026" : c.title;
    doc.text(shortTitle, COL_X.title, y, { maxWidth: COL_W.title });

    // Credits
    doc.text(String(c.credits), COL_X.cr, y);

    // Hub areas
    doc.setTextColor(90);
    const hubStr = c.hubAreas.map((h) => h.code).join(", ");
    doc.text(hubStr, COL_X.hubs, y, { maxWidth: COL_W.hubs });

    // Status badge
    const label = gradeStr || colors.label;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(label, COL_X.status, y, { maxWidth: COL_W.status });

    doc.setTextColor(0);
    y += rowH;
  }

  for (const semester of semesters) {
    const fixedHere = allCourses.filter(
      (c) => (c.status === "completed" || c.status === "in-progress") &&
        (assignments.has(c.id) ? assignments.get(c.id) === semester : c.semester === semester)
    );
    const plannedHere = allCourses.filter(
      (c) => c.status === "planned" && assignments.get(c.id) === semester
    );
    const allHere = [...fixedHere, ...plannedHere];
    if (allHere.length === 0) continue;

    const semCr = allHere.reduce((s, c) => s + c.credits, 0);
    const semHubs = [...new Set(allHere.flatMap((c) => c.hubAreas.map((h) => h.code)))];

    checkPage(24);

    // Semester header
    const isSummer = semester.startsWith("Summer");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    if (isSummer) doc.setTextColor(140, 90, 0);
    doc.text(semester, margin, y);
    doc.setTextColor(0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    const semInfo = `${semCr} credits  |  ${semHubs.length ? semHubs.join(", ") : "No hub areas"}`;
    doc.text(semInfo, margin + 32, y);
    doc.setTextColor(0);
    y += 5;
    tableHeader();

    for (const c of fixedHere) {
      const key = getStatusKey(c.status, true);
      const grade = c.grade ? `${c.grade}` : undefined;
      courseRow(c, key, grade);
    }
    for (const c of plannedHere) {
      courseRow(c, "planned");
    }

    y += 2;
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    doc.setDrawColor(0);
    y += 6;
  }

  // Unplanned pool
  const unplanned = allCourses.filter(
    (c) => c.status === "planned" && !assignments.has(c.id)
  );
  if (unplanned.length > 0) {
    checkPage(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`Courses I'm Interested In (${unplanned.length})`, margin, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text("Not yet assigned to a specific semester", margin, y + 4);
    doc.setTextColor(0);
    y += 9;
    tableHeader();
    for (const c of unplanned) courseRow(c, "unplanned");
    y += 4;
  }

  // ── Summary page ──────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Requirements Summary", margin, y);
  y += 6;
  hr();
  y += 7;

  // Per-program graduation requirements
  for (const prog of progress.programs.filter((p) => p.isActive && p.schoolRequirements && p.schoolRequirements.length > 0)) {
    checkPage(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${prog.name} Requirements`, margin, y);
    y += 5;

    for (const req of prog.schoolRequirements ?? []) {
      checkPage(7);
      const sym = req.satisfied ? "\u2713" : req.inProgress ? "\u25CF" : "\u2717";
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      if (req.satisfied) doc.setTextColor(0, 140, 0);
      else if (req.inProgress) doc.setTextColor(180, 120, 0);
      else doc.setTextColor(190, 40, 40);
      doc.text(sym, margin + 1, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.text(req.name, margin + 7, y);
      doc.setTextColor(110);
      doc.text(`${req.current} / ${req.target}`, pageW - margin, y, { align: "right" });
      doc.setTextColor(0);
      y += 5;
    }
    y += 3;
  }
  y += 2;

  // Hub Areas
  checkPage(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Hub Areas", margin, y);
  y += 5;

  for (const cap of progress.hubCapacities) {
    checkPage(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(cap.capacity, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`${cap.unitsFulfilled}/${cap.unitsRequired} units`, pageW - margin, y, { align: "right" });
    doc.setTextColor(0);
    y += 4;

    for (const area of cap.areas) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const fulfilled = area.unitsFulfilled >= area.unitsRequired;
      const partial = !fulfilled && area.unitsFulfilled > 0;
      if (fulfilled) doc.setTextColor(0, 140, 0);
      else if (partial) doc.setTextColor(150, 90, 0);
      else doc.setTextColor(110);
      doc.text(`  ${area.code}`, margin + 2, y);
      doc.setTextColor(80);
      doc.text(area.name, margin + 18, y, { maxWidth: 115 });
      doc.setTextColor(0);
      doc.text(`${area.unitsFulfilled}/${area.unitsRequired}`, pageW - margin, y, { align: "right" });
      y += 4;
    }
    y += 2;
  }

  // Active Programs
  const activeProgs = progress.programs.filter((p) => p.isActive);
  if (activeProgs.length > 0) {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Active Programs", margin, y);
    y += 5;

    for (const prog of activeProgs) {
      checkPage(8);
      const done = prog.totalCompleted >= prog.totalRequired;
      if (done) doc.setTextColor(0, 140, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(prog.name, margin + 3, y);
      doc.setTextColor(110);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${prog.totalCompleted}/${prog.totalRequired} complete`, pageW - margin, y, { align: "right" });
      doc.setTextColor(0);
      y += 5;
    }
  }

  // ── Embed import data ─────────────────────────────────────────────────────
  const exportData: PlannerExportData = {
    v: 1,
    exportDate: new Date().toISOString(),
    courses: allCourses.map((c) => ({
      code: c.code,
      status: c.status ?? "planned",
      semester: assignments.get(c.id) ?? c.semester ?? "",
      grade: c.grade ?? "",
    })),
  };

  // Base64-encode with full Unicode support
  const jsonStr = JSON.stringify(exportData);
  const b64 = btoa(unescape(encodeURIComponent(jsonStr)));

  doc.setProperties({
    title: "BU Degree Planner Export",
    subject: "University Semester Plan",
    keywords: DATA_PREFIX + b64,
    creator: "BU Degree Tracker",
    author: "BU Degree Tracker",
  });

  // Footnote
  const noteY = pageH - margin - 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(180);
  doc.text(
    "This PDF contains embedded machine-readable data. Upload it in the University Planner to restore your plan.",
    margin, noteY
  );
  doc.setTextColor(0);

  doc.save("bu-planner.pdf");
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importPlannerPdf(file: File): Promise<PlannerExportData> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const keywords = pdfDoc.getKeywords() ?? "";

  if (!keywords.startsWith(DATA_PREFIX)) {
    throw new Error(
      "This PDF does not contain BU Planner import data.\n" +
      "Make sure you are uploading a PDF that was exported from this planner."
    );
  }

  const b64 = keywords.slice(DATA_PREFIX.length);
  const jsonStr = decodeURIComponent(escape(atob(b64)));
  const data = JSON.parse(jsonStr) as PlannerExportData;

  if (data.v !== 1) {
    throw new Error(`Unsupported planner export version (${data.v}). Please export a new PDF.`);
  }

  return data;
}
