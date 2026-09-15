import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hub area definitions — unitsRequired matches constants.ts (the source of truth)
const HUB_AREAS = [
  { code: "PHI1", name: "Philosophical Inquiry and Life's Meanings", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },
  { code: "PHI2", name: "Aesthetic Exploration", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },
  { code: "PHI3", name: "Historical Consciousness", capacity: "Philosophical, Aesthetic, and Historical Interpretation", unitsRequired: 1 },
  { code: "SCI1", name: "Scientific Inquiry I", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SCI2", name: "Scientific Inquiry II", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SOC1", name: "Social Inquiry I", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "SOC2", name: "Social Inquiry II", capacity: "Scientific and Social Inquiry", unitsRequired: 1 },
  { code: "QR1", name: "Quantitative Reasoning I", capacity: "Quantitative Reasoning", unitsRequired: 1 },
  { code: "QR2", name: "Quantitative Reasoning II", capacity: "Quantitative Reasoning", unitsRequired: 1 },
  { code: "DIV1", name: "The Individual in Community", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 1 },
  { code: "DIV2", name: "Global Citizenship and Intercultural Literacy", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 2 },
  { code: "CIV1", name: "Ethical Reasoning", capacity: "Diversity, Civic Engagement, and Global Citizenship", unitsRequired: 1 },
  { code: "COM1", name: "First-Year Writing Seminar", capacity: "Communication", unitsRequired: 1 },
  { code: "COM2", name: "Writing, Research, and Inquiry", capacity: "Communication", unitsRequired: 1 },
  { code: "COM3", name: "Oral and/or Signed Communication", capacity: "Communication", unitsRequired: 1 },
  { code: "COM4", name: "Digital/Multimedia Expression", capacity: "Communication", unitsRequired: 1 },
  { code: "WIC", name: "Writing-Intensive Course", capacity: "Communication", unitsRequired: 2 },
  { code: "ITK1", name: "Teamwork/Collaboration", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK2", name: "Research and Information Literacy", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK3", name: "Creativity/Innovation", capacity: "Intellectual Toolkit", unitsRequired: 2 },
  { code: "ITK4", name: "Critical Thinking", capacity: "Intellectual Toolkit", unitsRequired: 2 },
];

// ── All courses ──────────────────────────────────────────────────────────────

const COURSES = [
  // ── Transcript: Fall 2025 (completed) ──────────────────────────────────────
  { code: "CAS LI 354E", title: "Contemporary Italian Literature", credits: 4, department: "LI", slug: "cas-li-354e" },
  { code: "CAS MA 1TR", title: "Mathematics Transfer Credit", credits: 4, department: "MA", slug: "cas-ma-1tr" },
  { code: "CAS PH 100", title: "Introduction to Philosophy", credits: 4, department: "PH", slug: "cas-ph-100" },
  { code: "CAS CS 111", title: "Intro Computer Science 1", credits: 4, department: "CS", slug: "cas-cs-111" },
  { code: "CAS CS 131", title: "Combinatoric Structures", credits: 4, department: "CS", slug: "cas-cs-131" },
  { code: "CAS WR 111", title: "Academic Writing for Multilingual Students", credits: 4, department: "WR", slug: "cas-wr-111" },
  { code: "COM CM 217", title: "Introduction to Advertising", credits: 4, department: "CM", slug: "com-cm-217" },
  { code: "CAS FY 101", title: "First Year Experience", credits: 1, department: "FY", slug: "cas-fy-101" },

  // ── Transcript: Spring 2026 (completed) ────────────────────────────────────
  { code: "CAS CS 112", title: "Intro Computer Science 2", credits: 4, department: "CS", slug: "cas-cs-112" },
  { code: "CAS CS 132", title: "Geometric Algorithms", credits: 4, department: "CS", slug: "cas-cs-132" },
  { code: "CAS WR 112", title: "Critical Literacies for Multilingual Students", credits: 4, department: "WR", slug: "cas-wr-112" },
  { code: "QST SM 131", title: "Business, Markets, and Society", credits: 4, department: "SM", slug: "qst-sm-131" },

  // ── Transcript: Summer 2026 (completed) ────────────────────────────────────
  { code: "CAS RN 103S", title: "Religions of Asia", credits: 4, department: "RN", slug: "cas-rn-103s" },
  { code: "SHA HF 100S", title: "Introduction to Hospitality", credits: 4, department: "HF", slug: "sha-hf-100s" },

  // ── Transcript: Fall 2026 (in progress) ────────────────────────────────────
  { code: "CAS AS 101", title: "The Solar System", credits: 4, department: "AS", slug: "cas-as-101" },
  { code: "CAS CS 210", title: "Computer Systems", credits: 4, department: "CS", slug: "cas-cs-210" },
  { code: "CAS CS 237", title: "Probability in Computing", credits: 4, department: "CS", slug: "cas-cs-237" },
  { code: "CAS WR 120", title: "First-Year Writing Seminar", credits: 4, department: "WR", slug: "cas-wr-120" },

  // ── Future CS courses ──────────────────────────────────────────────────────
  { code: "CAS CS 235", title: "Algebraic Algorithms", credits: 4, department: "CS", slug: "cas-cs-235" },
  { code: "CAS CS 320", title: "Concepts of Programming Languages", credits: 4, department: "CS", slug: "cas-cs-320" },
  { code: "CAS CS 330", title: "Introduction to Analysis of Algorithms", credits: 4, department: "CS", slug: "cas-cs-330" },
  { code: "CAS CS 332", title: "Elements of the Theory of Computation", credits: 4, department: "CS", slug: "cas-cs-332" },
  { code: "CAS CS 350", title: "Fundamentals of Computing Systems", credits: 4, department: "CS", slug: "cas-cs-350" },
  { code: "CAS CS 365", title: "Foundations of Data Science", credits: 4, department: "CS", slug: "cas-cs-365" },
  { code: "CAS CS 410", title: "Advanced Software Systems", credits: 4, department: "CS", slug: "cas-cs-410" },
  { code: "CAS CS 411", title: "Software Engineering", credits: 4, department: "CS", slug: "cas-cs-411" },
  { code: "CAS CS 440", title: "Introduction to Artificial Intelligence", credits: 4, department: "CS", slug: "cas-cs-440" },
  { code: "CAS CS 451", title: "Distributed Systems", credits: 4, department: "CS", slug: "cas-cs-451" },
  { code: "CAS CS 455", title: "Computer Networks", credits: 4, department: "CS", slug: "cas-cs-455" },
  { code: "CAS CS 460", title: "Introduction to Database Systems", credits: 4, department: "CS", slug: "cas-cs-460" },
  { code: "CAS CS 480", title: "Introduction to Computer Graphics", credits: 4, department: "CS", slug: "cas-cs-480" },
  { code: "CAS CS 506", title: "Computational Tools for Data Science", credits: 4, department: "CS", slug: "cas-cs-506" },
  { code: "CAS CS 530", title: "Graduate Algorithms", credits: 4, department: "CS", slug: "cas-cs-530" },
  { code: "CAS CS 535", title: "Complexity Theory", credits: 4, department: "CS", slug: "cas-cs-535" },
  { code: "CAS CS 542", title: "Machine Learning", credits: 4, department: "CS", slug: "cas-cs-542" },
  { code: "CAS CS 548", title: "Natural Language Processing", credits: 4, department: "CS", slug: "cas-cs-548" },
  { code: "CAS CS 585", title: "Image and Video Computing", credits: 4, department: "CS", slug: "cas-cs-585" },

  // ── Math / Stats ───────────────────────────────────────────────────────────
  { code: "CAS MA 225", title: "Multivariate Calculus", credits: 4, department: "MA", slug: "cas-ma-225" },
  { code: "CAS MA 226", title: "Differential Equations", credits: 4, department: "MA", slug: "cas-ma-226" },
  { code: "CAS MA 242", title: "Linear Algebra", credits: 4, department: "MA", slug: "cas-ma-242" },
  { code: "CAS MA 416", title: "Introduction to Stochastic Processes", credits: 4, department: "MA", slug: "cas-ma-416" },
  { code: "CAS MA 213", title: "Basic Statistics and Probability", credits: 4, department: "MA", slug: "cas-ma-213" },
  { code: "CAS MA 214", title: "Applied Statistics", credits: 4, department: "MA", slug: "cas-ma-214" },
  { code: "CAS MA 684", title: "Mathematical Statistics", credits: 4, department: "MA", slug: "cas-ma-684" },

  // ── Economics ──────────────────────────────────────────────────────────────
  { code: "CAS EC 101", title: "Introductory Microeconomic Analysis", credits: 4, department: "EC", slug: "cas-ec-101" },
  { code: "CAS EC 102", title: "Introductory Macroeconomic Analysis", credits: 4, department: "EC", slug: "cas-ec-102" },
  { code: "CAS EC 201", title: "Intermediate Microeconomic Analysis", credits: 4, department: "EC", slug: "cas-ec-201" },
  { code: "CAS EC 202", title: "Intermediate Macroeconomic Analysis", credits: 4, department: "EC", slug: "cas-ec-202" },
  { code: "CAS EC 303", title: "Empirical Economics I", credits: 4, department: "EC", slug: "cas-ec-303" },
  { code: "CAS EC 304", title: "Empirical Economics II", credits: 4, department: "EC", slug: "cas-ec-304" },

  // ── International Relations ────────────────────────────────────────────────
  { code: "CAS IR 230", title: "Introduction to International Relations", credits: 4, department: "IR", slug: "cas-ir-230" },
  { code: "CAS IR 271", title: "International Political Economy", credits: 4, department: "IR", slug: "cas-ir-271" },
  { code: "CAS IR 348", title: "Methods of Political Research", credits: 4, department: "IR", slug: "cas-ir-348" },
  { code: "CAS IR 395", title: "Theories of International Relations", credits: 4, department: "IR", slug: "cas-ir-395" },
  { code: "CAS IR 311", title: "International Institutions", credits: 4, department: "IR", slug: "cas-ir-311" },
  { code: "CAS IR 332", title: "Politics of the Middle East", credits: 4, department: "IR", slug: "cas-ir-332" },
  { code: "CAS IR 360", title: "International Security", credits: 4, department: "IR", slug: "cas-ir-360" },
  { code: "CAS IR 499", title: "Senior Seminar in International Relations", credits: 4, department: "IR", slug: "cas-ir-499" },

  // ── Humanities — Art History, Music, Classics, History ─────────────────────
  { code: "CAS AH 111", title: "Introduction to Art History I", credits: 4, department: "AH", slug: "cas-ah-111" },
  { code: "CAS AH 112", title: "Introduction to Art History II", credits: 4, department: "AH", slug: "cas-ah-112" },
  { code: "CAS MU 101", title: "First-Year Music Theory and Practice", credits: 4, department: "MU", slug: "cas-mu-101" },
  { code: "CAS HI 150", title: "The West and the World to 1700", credits: 4, department: "HI", slug: "cas-hi-150" },
  { code: "CAS HI 151", title: "The Modern World Since 1700", credits: 4, department: "HI", slug: "cas-hi-151" },
  { code: "CAS HI 290", title: "Introduction to Historical Methods", credits: 4, department: "HI", slug: "cas-hi-290" },
  { code: "CAS CL 102", title: "Classical Civilization: Rome", credits: 4, department: "CL", slug: "cas-cl-102" },
  { code: "CAS EN 120", title: "Introduction to Creative Writing", credits: 4, department: "EN", slug: "cas-en-120" },
  { code: "CAS EN 125", title: "Reading and Writing Poetry", credits: 4, department: "EN", slug: "cas-en-125" },

  // ── Philosophy / Religion ──────────────────────────────────────────────────
  { code: "CAS PH 160", title: "Introduction to Ethics", credits: 4, department: "PH", slug: "cas-ph-160" },
  { code: "CAS PH 260", title: "Biomedical Ethics", credits: 4, department: "PH", slug: "cas-ph-260" },
  { code: "CAS RN 101", title: "Introduction to the Study of Religion", credits: 4, department: "RN", slug: "cas-rn-101" },

  // ── Natural Sciences — Biology, Chemistry, Physics ────────────────────────
  { code: "CAS BI 107", title: "Introductory Biology I", credits: 4, department: "BI", slug: "cas-bi-107" },
  { code: "CAS BI 108", title: "Introductory Biology II", credits: 4, department: "BI", slug: "cas-bi-108" },
  { code: "CAS BI 303", title: "Molecular Biology", credits: 4, department: "BI", slug: "cas-bi-303" },
  { code: "CAS BI 315", title: "Cell Biology", credits: 4, department: "BI", slug: "cas-bi-315" },
  { code: "CAS CH 101", title: "General Chemistry I", credits: 4, department: "CH", slug: "cas-ch-101" },
  { code: "CAS CH 102", title: "General Chemistry II", credits: 4, department: "CH", slug: "cas-ch-102" },
  { code: "CAS PY 211", title: "General Physics I", credits: 4, department: "PY", slug: "cas-py-211" },
  { code: "CAS PY 212", title: "General Physics II", credits: 4, department: "PY", slug: "cas-py-212" },

  // ── Social Sciences — Political Science, Sociology, Anthropology ──────────
  { code: "CAS PO 101", title: "Introduction to American Politics", credits: 4, department: "PO", slug: "cas-po-101" },
  { code: "CAS PO 141", title: "Introduction to Comparative Politics", credits: 4, department: "PO", slug: "cas-po-141" },
  { code: "CAS SO 100", title: "Principles of Sociology", credits: 4, department: "SO", slug: "cas-so-100" },
  { code: "CAS SO 212", title: "Race, Ethnicity and Society", credits: 4, department: "SO", slug: "cas-so-212" },
  { code: "CAS AN 101", title: "Introduction to Cultural Anthropology", credits: 4, department: "AN", slug: "cas-an-101" },
  { code: "CAS AA 100", title: "Introduction to African American Studies", credits: 4, department: "AA", slug: "cas-aa-100" },
  { code: "CAS WS 100", title: "Introduction to Women's, Gender, and Sexuality Studies", credits: 4, department: "WS", slug: "cas-ws-100" },

  // ── Psychology ─────────────────────────────────────────────────────────────
  { code: "CAS PS 101", title: "General Psychology", credits: 4, department: "PS", slug: "cas-ps-101" },
  { code: "CAS PS 201", title: "Research Methods in Psychology", credits: 4, department: "PS", slug: "cas-ps-201" },
  { code: "CAS PS 241", title: "Psychological Statistics", credits: 4, department: "PS", slug: "cas-ps-241" },
  { code: "CAS PS 305", title: "Cognitive Psychology", credits: 4, department: "PS", slug: "cas-ps-305" },
  { code: "CAS PS 325", title: "Brain & Behavior", credits: 4, department: "PS", slug: "cas-ps-325" },
  { code: "CAS PS 330", title: "Abnormal Psychology", credits: 4, department: "PS", slug: "cas-ps-330" },
  { code: "CAS PS 340", title: "Developmental Psychology", credits: 4, department: "PS", slug: "cas-ps-340" },
  { code: "CAS PS 371", title: "Social Psychology", credits: 4, department: "PS", slug: "cas-ps-371" },

  // ── Communication / Writing ────────────────────────────────────────────────
  { code: "CAS WR 150", title: "Writing and Research Seminar", credits: 4, department: "WR", slug: "cas-wr-150" },
  { code: "CAS WR 152", title: "Writing and Research Seminar II", credits: 4, department: "WR", slug: "cas-wr-152" },
  { code: "COM CM 225", title: "Rhetoric", credits: 4, department: "CM", slug: "com-cm-225" },
  { code: "COM CM 331", title: "Public Speaking", credits: 4, department: "CM", slug: "com-cm-331" },
  { code: "COM CM 380", title: "Communication Research Methods", credits: 4, department: "CM", slug: "com-cm-380" },
];

// ── User progress ────────────────────────────────────────────────────────────

const USER_PROGRESS: { code: string; status: "completed" | "in-progress"; semester: string; grade: string }[] = [
  // Fall 2025
  { code: "CAS LI 354E", status: "completed", semester: "Fall 2025", grade: "T" },
  { code: "CAS MA 1TR", status: "completed", semester: "Fall 2025", grade: "T" },
  { code: "CAS PH 100", status: "completed", semester: "Fall 2025", grade: "T" },
  { code: "CAS CS 111", status: "completed", semester: "Fall 2025", grade: "A-" },
  { code: "CAS CS 131", status: "completed", semester: "Fall 2025", grade: "B+" },
  { code: "CAS WR 111", status: "completed", semester: "Fall 2025", grade: "P" },
  { code: "COM CM 217", status: "completed", semester: "Fall 2025", grade: "A-" },
  { code: "CAS FY 101", status: "completed", semester: "Fall 2025", grade: "P" },
  // Spring 2026
  { code: "CAS CS 112", status: "completed", semester: "Spring 2026", grade: "B+" },
  { code: "CAS CS 132", status: "completed", semester: "Spring 2026", grade: "A" },
  { code: "CAS WR 112", status: "completed", semester: "Spring 2026", grade: "P" },
  { code: "QST SM 131", status: "completed", semester: "Spring 2026", grade: "B+" },
  // Summer 2026
  { code: "CAS RN 103S", status: "completed", semester: "Summer 2026", grade: "A" },
  { code: "SHA HF 100S", status: "completed", semester: "Summer 2026", grade: "A" },
  // Fall 2026
  { code: "CAS AS 101", status: "in-progress", semester: "Fall 2026", grade: "" },
  { code: "CAS CS 210", status: "in-progress", semester: "Fall 2026", grade: "" },
  { code: "CAS CS 237", status: "in-progress", semester: "Fall 2026", grade: "" },
  { code: "CAS WR 120", status: "in-progress", semester: "Fall 2026", grade: "" },
];

// ── Hub-to-Course mappings ───────────────────────────────────────────────────
// Comprehensive: every future hub area has multiple candidate courses.

const HUB_MAPPINGS: { courseCode: string; hubCodes: string[] }[] = [
  // --- Already-taken courses (transcript) ---
  { courseCode: "CAS PH 100", hubCodes: ["PHI1"] },
  { courseCode: "CAS RN 103S", hubCodes: ["PHI1", "DIV2", "ITK1"] },
  { courseCode: "SHA HF 100S", hubCodes: ["SOC1"] },
  { courseCode: "QST SM 131", hubCodes: ["SOC1", "ITK1", "ITK2"] },
  { courseCode: "CAS CS 111", hubCodes: ["QR2", "ITK3", "COM4"] },
  { courseCode: "CAS CS 112", hubCodes: ["QR2", "ITK3", "ITK4"] },
  { courseCode: "CAS CS 131", hubCodes: ["QR1", "ITK4"] },
  { courseCode: "CAS CS 132", hubCodes: ["QR1"] },
  { courseCode: "CAS AS 101", hubCodes: ["SCI1"] },
  { courseCode: "CAS WR 120", hubCodes: ["COM1"] },

  // --- Humanities (PHI2, PHI3) ---
  { courseCode: "CAS AH 111", hubCodes: ["PHI2", "ITK2"] },
  { courseCode: "CAS AH 112", hubCodes: ["PHI2"] },
  { courseCode: "CAS MU 101", hubCodes: ["PHI2", "ITK3"] },
  { courseCode: "CAS HI 150", hubCodes: ["PHI3"] },
  { courseCode: "CAS HI 151", hubCodes: ["PHI3", "DIV2"] },
  { courseCode: "CAS HI 290", hubCodes: ["PHI3", "WIC"] },
  { courseCode: "CAS CL 102", hubCodes: ["PHI3", "PHI1"] },
  { courseCode: "CAS EN 120", hubCodes: ["WIC", "PHI2"] },
  { courseCode: "CAS EN 125", hubCodes: ["PHI2", "WIC"] },

  // --- Philosophy / Religion (CIV1) ---
  { courseCode: "CAS PH 160", hubCodes: ["CIV1"] },
  { courseCode: "CAS PH 260", hubCodes: ["CIV1", "WIC"] },
  { courseCode: "CAS RN 101", hubCodes: ["CIV1", "DIV1"] },

  // --- Sciences (SCI1, SCI2) ---
  { courseCode: "CAS BI 107", hubCodes: ["SCI1"] },
  { courseCode: "CAS BI 108", hubCodes: ["SCI2"] },
  { courseCode: "CAS CH 101", hubCodes: ["SCI1", "QR1"] },
  { courseCode: "CAS CH 102", hubCodes: ["SCI2"] },
  { courseCode: "CAS PY 211", hubCodes: ["SCI1", "QR1"] },
  { courseCode: "CAS PY 212", hubCodes: ["SCI2", "QR2"] },

  // --- Social Sciences (SOC1, SOC2) ---
  { courseCode: "CAS PO 101", hubCodes: ["SOC2"] },
  { courseCode: "CAS PO 141", hubCodes: ["SOC2", "DIV2"] },
  { courseCode: "CAS SO 100", hubCodes: ["SOC1", "ITK2"] },
  { courseCode: "CAS SO 212", hubCodes: ["DIV1", "SOC2", "WIC"] },
  { courseCode: "CAS AN 101", hubCodes: ["SOC2", "DIV2"] },
  { courseCode: "CAS EC 101", hubCodes: ["SOC2"] },
  { courseCode: "CAS EC 102", hubCodes: ["SOC2"] },
  { courseCode: "CAS EC 303", hubCodes: ["QR2", "ITK2"] },

  // --- Diversity (DIV1) ---
  { courseCode: "CAS AA 100", hubCodes: ["DIV1", "SOC1"] },
  { courseCode: "CAS WS 100", hubCodes: ["DIV1", "SOC2"] },

  // --- Communication (COM2, COM3, WIC) ---
  { courseCode: "CAS WR 150", hubCodes: ["COM2", "WIC"] },
  { courseCode: "CAS WR 152", hubCodes: ["COM2"] },
  { courseCode: "COM CM 225", hubCodes: ["COM3", "ITK1"] },
  { courseCode: "COM CM 331", hubCodes: ["COM3"] },
  { courseCode: "COM CM 380", hubCodes: ["COM3", "ITK2"] },

  // --- International Relations ---
  { courseCode: "CAS IR 230", hubCodes: ["DIV2", "SOC1"] },
  { courseCode: "CAS IR 271", hubCodes: ["SOC2", "DIV2"] },
  { courseCode: "CAS IR 332", hubCodes: ["DIV2", "PHI3"] },
  { courseCode: "CAS IR 360", hubCodes: ["SOC2", "ITK4"] },

  // --- Psychology ---
  { courseCode: "CAS PS 101", hubCodes: ["SCI1", "SOC1"] },
  { courseCode: "CAS PS 201", hubCodes: ["SCI2", "ITK2"] },
  { courseCode: "CAS PS 241", hubCodes: ["QR1", "SCI2"] },
  { courseCode: "CAS PS 330", hubCodes: ["SCI2", "ITK4"] },
  { courseCode: "CAS PS 371", hubCodes: ["SOC1", "DIV1"] },
  { courseCode: "CAS PS 340", hubCodes: ["SCI2"] },

  // --- Future CS courses with hub coverage ---
  { courseCode: "CAS CS 320", hubCodes: ["ITK4"] },
  { courseCode: "CAS CS 411", hubCodes: ["ITK1", "COM4"] },
  { courseCode: "CAS CS 460", hubCodes: ["ITK2"] },
  { courseCode: "CAS CS 506", hubCodes: ["ITK2", "QR2"] },
  { courseCode: "CAS CS 542", hubCodes: ["ITK3", "QR2"] },
  { courseCode: "CAS CS 548", hubCodes: ["ITK3"] },
  { courseCode: "CAS CS 585", hubCodes: ["ITK3", "COM4"] },

  // --- Math courses ---
  { courseCode: "CAS MA 225", hubCodes: ["QR1"] },
  { courseCode: "CAS MA 242", hubCodes: ["QR1"] },
  { courseCode: "CAS MA 213", hubCodes: ["QR1", "SOC1"] },
  { courseCode: "CAS LI 354E", hubCodes: ["PHI2", "DIV2"] },
];

// ── Programs ─────────────────────────────────────────────────────────────────

const PROGRAMS = [
  {
    code: "cs-ba",
    name: "Computer Science BA",
    type: "major",
    description: "Bachelor of Arts in Computer Science from the College of Arts & Sciences",
    isActive: true,
    requirements: [
      {
        groupName: "A",
        description: "Foundational Courses - all five required",
        minCourses: 5,
        courses: [
          { code: "CAS CS 111", isRequired: true },
          { code: "CAS CS 112", isRequired: true },
          { code: "CAS CS 131", isRequired: true },
          { code: "CAS CS 210", isRequired: true },
          { code: "CAS CS 330", isRequired: true },
        ],
      },
      {
        groupName: "B",
        description: "Formal Tools - pick two",
        minCourses: 2,
        courses: [
          { code: "CAS CS 132", isRequired: false },
          { code: "CAS CS 235", isRequired: false },
          { code: "CAS CS 237", isRequired: false },
        ],
      },
      {
        groupName: "C",
        description: "Central Topics - pick two",
        minCourses: 2,
        courses: [
          { code: "CAS CS 320", isRequired: false },
          { code: "CAS CS 332", isRequired: false },
          { code: "CAS CS 350", isRequired: false },
        ],
      },
      {
        groupName: "D",
        description: "Electives - six additional 300/400/500-level CS courses",
        minCourses: 6,
        courses: [] as { code: string; isRequired: boolean }[],
      },
    ],
  },
  {
    code: "math-minor",
    name: "Mathematics Minor",
    type: "minor",
    description: "Minor in Mathematics from CAS",
    isActive: true,
    requirements: [
      {
        groupName: "Core",
        description: "Required core courses",
        minCourses: 3,
        courses: [
          { code: "CAS MA 225", isRequired: true },
          { code: "CAS MA 226", isRequired: true },
          { code: "CAS MA 242", isRequired: true },
        ],
      },
      {
        groupName: "Electives",
        description: "Two 400+ level MA courses",
        minCourses: 2,
        courses: [
          { code: "CAS MA 416", isRequired: false },
        ],
      },
    ],
  },
  {
    code: "stats-minor",
    name: "Statistics Minor",
    type: "minor",
    description: "Minor in Statistics from CAS",
    isActive: true,
    requirements: [
      {
        groupName: "Core",
        description: "Required statistics courses",
        minCourses: 5,
        courses: [
          { code: "CAS MA 213", isRequired: true },
          { code: "CAS MA 214", isRequired: true },
          { code: "CAS MA 225", isRequired: true },
          { code: "CAS MA 416", isRequired: true },
          { code: "CAS MA 684", isRequired: true },
        ],
      },
      {
        groupName: "Electives",
        description: "One elective course",
        minCourses: 1,
        courses: [] as { code: string; isRequired: boolean }[],
      },
    ],
  },
  {
    code: "cs-econ",
    name: "CS & Economics Joint Major",
    type: "joint-major",
    description: "Joint major combining Computer Science and Economics",
    isActive: true,
    requirements: [
      {
        groupName: "CS Core",
        description: "Required CS courses",
        minCourses: 5,
        courses: [
          { code: "CAS CS 111", isRequired: true },
          { code: "CAS CS 112", isRequired: true },
          { code: "CAS CS 131", isRequired: true },
          { code: "CAS CS 210", isRequired: true },
          { code: "CAS CS 330", isRequired: true },
        ],
      },
      {
        groupName: "Econ Core",
        description: "Required Economics courses",
        minCourses: 2,
        courses: [
          { code: "CAS EC 101", isRequired: true },
          { code: "CAS EC 102", isRequired: true },
        ],
      },
    ],
  },
  {
    code: "cas-intl-relations-ba",
    name: "International Relations BA",
    type: "major",
    description: "Bachelor of Arts in International Relations from the Pardee School",
    isActive: true,
    requirements: [
      {
        groupName: "Core",
        description: "Required gateway and theory courses — all three required",
        minCourses: 3,
        courses: [
          { code: "CAS IR 230", isRequired: true },
          { code: "CAS IR 271", isRequired: true },
          { code: "CAS IR 395", isRequired: true },
        ],
      },
      {
        groupName: "Methods",
        description: "Quantitative research methods — required",
        minCourses: 1,
        courses: [
          { code: "CAS IR 348", isRequired: true },
          { code: "CAS MA 213", isRequired: false },
        ],
      },
      {
        groupName: "Upper-Level Concentration",
        description: "Regional & functional concentration — at least 3 courses at 300+ level",
        minCourses: 3,
        courses: [
          { code: "CAS IR 311", isRequired: false },
          { code: "CAS IR 332", isRequired: false },
          { code: "CAS IR 360", isRequired: false },
        ],
      },
      {
        groupName: "Senior Seminar",
        description: "Required capstone — IR 499",
        minCourses: 1,
        courses: [
          { code: "CAS IR 499", isRequired: true },
        ],
      },
    ],
  },
  {
    code: "econ-minor",
    name: "Economics Minor",
    type: "minor",
    description: "Minor in Economics from CAS",
    isActive: true,
    requirements: [
      {
        groupName: "Core",
        description: "Required introductory sequence",
        minCourses: 2,
        courses: [
          { code: "CAS EC 101", isRequired: true },
          { code: "CAS EC 102", isRequired: true },
        ],
      },
      {
        groupName: "Intermediate",
        description: "Intermediate theory courses",
        minCourses: 2,
        courses: [
          { code: "CAS EC 201", isRequired: false },
          { code: "CAS EC 202", isRequired: false },
        ],
      },
      {
        groupName: "Electives",
        description: "Upper-level economics elective",
        minCourses: 1,
        courses: [
          { code: "CAS EC 303", isRequired: false },
          { code: "CAS EC 304", isRequired: false },
        ],
      },
    ],
  },
  {
    code: "psych-ba",
    name: "Psychology BA",
    type: "major",
    description: "Bachelor of Arts in Psychology from CAS",
    isActive: true,
    requirements: [
      {
        groupName: "Introductory",
        description: "Required introductory course",
        minCourses: 1,
        courses: [
          { code: "CAS PS 101", isRequired: true },
        ],
      },
      {
        groupName: "Methods & Statistics",
        description: "Research methods and statistics",
        minCourses: 2,
        courses: [
          { code: "CAS PS 201", isRequired: true },
          { code: "CAS PS 241", isRequired: true },
        ],
      },
      {
        groupName: "Core Areas",
        description: "Core psychology areas — pick two",
        minCourses: 2,
        courses: [
          { code: "CAS PS 305", isRequired: false },
          { code: "CAS PS 325", isRequired: false },
          { code: "CAS PS 330", isRequired: false },
        ],
      },
      {
        groupName: "Electives",
        description: "Three additional 300+ level PS courses",
        minCourses: 3,
        courses: [] as { code: string; isRequired: boolean }[],
      },
    ],
  },
  {
    code: "bio-minor",
    name: "Biology Minor",
    type: "minor",
    description: "Minor in Biology from CAS",
    isActive: true,
    requirements: [
      {
        groupName: "Core",
        description: "Introductory biology sequence",
        minCourses: 2,
        courses: [
          { code: "CAS BI 107", isRequired: true },
          { code: "CAS BI 108", isRequired: true },
        ],
      },
      {
        groupName: "Chemistry",
        description: "Chemistry prerequisite",
        minCourses: 1,
        courses: [
          { code: "CAS CH 101", isRequired: true },
        ],
      },
      {
        groupName: "Upper-Level",
        description: "Two 300+ level BI courses",
        minCourses: 2,
        courses: [
          { code: "CAS BI 303", isRequired: false },
          { code: "CAS BI 315", isRequired: false },
        ],
      },
    ],
  },
];

// Which programs the test user is tracking (userId = "")
const USER_PROGRAMS = ["cs-ba", "stats-minor"];

// ── Prerequisites ────────────────────────────────────────────────────────────

const PREREQUISITES: { course: string; prereq: string; groupId: number; groupType: string }[] = [
  // CS prerequisite chains
  { course: "CAS CS 112", prereq: "CAS CS 111", groupId: 0, groupType: "AND" },
  { course: "CAS CS 132", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 210", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 210", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 235", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 235", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 237", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 237", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 320", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 320", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 330", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 330", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 332", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 332", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 350", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 350", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 365", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 365", prereq: "CAS CS 132", groupId: 0, groupType: "AND" },
  { course: "CAS CS 410", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 411", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 440", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 440", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 451", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 455", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 460", prereq: "CAS CS 210", groupId: 0, groupType: "AND" },
  { course: "CAS CS 480", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 480", prereq: "CAS CS 131", groupId: 0, groupType: "AND" },
  { course: "CAS CS 506", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 530", prereq: "CAS CS 330", groupId: 0, groupType: "AND" },
  { course: "CAS CS 535", prereq: "CAS CS 330", groupId: 0, groupType: "AND" },
  { course: "CAS CS 542", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 542", prereq: "CAS CS 132", groupId: 0, groupType: "AND" },
  { course: "CAS CS 548", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },
  { course: "CAS CS 585", prereq: "CAS CS 112", groupId: 0, groupType: "AND" },

  // Science chains
  { course: "CAS BI 108", prereq: "CAS BI 107", groupId: 0, groupType: "AND" },
  { course: "CAS BI 303", prereq: "CAS BI 108", groupId: 0, groupType: "AND" },
  { course: "CAS BI 315", prereq: "CAS BI 108", groupId: 0, groupType: "AND" },
  { course: "CAS CH 102", prereq: "CAS CH 101", groupId: 0, groupType: "AND" },
  { course: "CAS PY 212", prereq: "CAS PY 211", groupId: 0, groupType: "AND" },

  // Economics chains
  { course: "CAS EC 201", prereq: "CAS EC 101", groupId: 0, groupType: "AND" },
  { course: "CAS EC 202", prereq: "CAS EC 102", groupId: 0, groupType: "AND" },
  { course: "CAS EC 303", prereq: "CAS EC 201", groupId: 0, groupType: "AND" },
  { course: "CAS EC 304", prereq: "CAS EC 202", groupId: 0, groupType: "AND" },

  // Math chains
  { course: "CAS MA 226", prereq: "CAS MA 225", groupId: 0, groupType: "AND" },
  { course: "CAS MA 416", prereq: "CAS MA 242", groupId: 0, groupType: "AND" },
  { course: "CAS MA 684", prereq: "CAS MA 213", groupId: 0, groupType: "AND" },

  // Psychology chains
  { course: "CAS PS 201", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 241", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 305", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 325", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 330", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 340", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },
  { course: "CAS PS 371", prereq: "CAS PS 101", groupId: 0, groupType: "AND" },

  // Sociology chain
  { course: "CAS SO 212", prereq: "CAS SO 100", groupId: 0, groupType: "AND" },

  // Art History chain
  { course: "CAS AH 112", prereq: "CAS AH 111", groupId: 0, groupType: "AND" },

  // Philosophy chain
  { course: "CAS PH 260", prereq: "CAS PH 160", groupId: 0, groupType: "AND" },

  // IR chains
  { course: "CAS IR 395", prereq: "CAS IR 230", groupId: 0, groupType: "AND" },
  { course: "CAS IR 499", prereq: "CAS IR 395", groupId: 0, groupType: "AND" },
];

// ── Course schedules (term offering patterns) ────────────────────────────────
// Multiple semesters establish which terms a course is offered in.
// The plan generator extracts "Fall"/"Spring" from `semester` to check offeredIn().

const SCHEDULES: { courseCode: string; semester: string; days: string; startTime: string; endTime: string }[] = [
  // CS courses — Fall only
  { courseCode: "CAS CS 111", semester: "Fall 2026", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS CS 111", semester: "Fall 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS CS 131", semester: "Fall 2026", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 131", semester: "Fall 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 210", semester: "Fall 2026", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CS 210", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CS 235", semester: "Fall 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS CS 332", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS CS 350", semester: "Fall 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS CS 440", semester: "Fall 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS CS 480", semester: "Fall 2027", days: "M,W,F", startTime: "14:20", endTime: "15:10" },

  // CS courses — Spring only
  { courseCode: "CAS CS 112", semester: "Spring 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS CS 112", semester: "Spring 2028", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS CS 132", semester: "Spring 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 237", semester: "Spring 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS CS 365", semester: "Spring 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS CS 411", semester: "Spring 2027", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS CS 411", semester: "Spring 2028", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS CS 451", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CS 455", semester: "Spring 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS CS 455", semester: "Spring 2028", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS CS 530", semester: "Spring 2028", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS CS 535", semester: "Spring 2028", days: "M,W,F", startTime: "11:15", endTime: "12:05" },

  // CS courses — both Fall and Spring
  { courseCode: "CAS CS 320", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS CS 320", semester: "Spring 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS CS 330", semester: "Fall 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 330", semester: "Spring 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 410", semester: "Fall 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS CS 410", semester: "Spring 2028", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS CS 460", semester: "Fall 2027", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS CS 460", semester: "Spring 2027", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS CS 506", semester: "Fall 2027", days: "M,W", startTime: "14:20", endTime: "15:35" },
  { courseCode: "CAS CS 506", semester: "Spring 2028", days: "M,W", startTime: "14:20", endTime: "15:35" },
  { courseCode: "CAS CS 542", semester: "Fall 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS CS 542", semester: "Spring 2028", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS CS 548", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CS 548", semester: "Spring 2028", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CS 585", semester: "Fall 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS CS 585", semester: "Spring 2028", days: "T,R", startTime: "09:30", endTime: "10:45" },

  // Gen-ed & hub courses — both semesters (most are offered every term)
  { courseCode: "CAS AH 111", semester: "Fall 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS AH 111", semester: "Spring 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS AH 112", semester: "Spring 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS AH 112", semester: "Spring 2028", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS HI 150", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS HI 151", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS HI 151", semester: "Spring 2028", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS PH 160", semester: "Fall 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS PH 160", semester: "Spring 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS PH 260", semester: "Spring 2028", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS WR 150", semester: "Fall 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS WR 150", semester: "Spring 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "COM CM 331", semester: "Fall 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "COM CM 331", semester: "Spring 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "COM CM 225", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "COM CM 225", semester: "Spring 2028", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS AN 101", semester: "Fall 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS AN 101", semester: "Spring 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS SO 100", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS SO 100", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS EN 120", semester: "Fall 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS EN 120", semester: "Spring 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS RN 101", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS RN 101", semester: "Spring 2028", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS AA 100", semester: "Fall 2027", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS AA 100", semester: "Spring 2027", days: "T,R", startTime: "15:30", endTime: "16:45" },
  { courseCode: "CAS WS 100", semester: "Fall 2027", days: "M,W,F", startTime: "14:20", endTime: "15:10" },
  { courseCode: "CAS WS 100", semester: "Spring 2028", days: "M,W,F", startTime: "14:20", endTime: "15:10" },
  { courseCode: "CAS PO 101", semester: "Fall 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS PO 101", semester: "Spring 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },

  // Science courses
  { courseCode: "CAS BI 107", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS BI 108", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS BI 108", semester: "Spring 2028", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS CH 101", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS CH 102", semester: "Spring 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS PY 211", semester: "Fall 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS PY 212", semester: "Spring 2028", days: "M,W,F", startTime: "13:25", endTime: "14:15" },

  // Psychology
  { courseCode: "CAS PS 101", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS PS 101", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS PS 201", semester: "Spring 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS PS 201", semester: "Spring 2028", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS PS 241", semester: "Fall 2027", days: "T,R", startTime: "09:30", endTime: "10:45" },
  { courseCode: "CAS PS 241", semester: "Spring 2028", days: "T,R", startTime: "09:30", endTime: "10:45" },

  // Economics
  { courseCode: "CAS EC 101", semester: "Fall 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS EC 101", semester: "Spring 2027", days: "M,W,F", startTime: "09:05", endTime: "09:55" },
  { courseCode: "CAS EC 102", semester: "Fall 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS EC 102", semester: "Spring 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS EC 201", semester: "Fall 2027", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS EC 201", semester: "Spring 2028", days: "M,W,F", startTime: "13:25", endTime: "14:15" },
  { courseCode: "CAS EC 202", semester: "Spring 2028", days: "T,R", startTime: "14:00", endTime: "15:15" },

  // Math
  { courseCode: "CAS MA 225", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS MA 225", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS MA 226", semester: "Spring 2027", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS MA 226", semester: "Spring 2028", days: "T,R", startTime: "11:00", endTime: "12:15" },
  { courseCode: "CAS MA 242", semester: "Fall 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS MA 242", semester: "Spring 2027", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS MA 213", semester: "Fall 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },
  { courseCode: "CAS MA 213", semester: "Spring 2027", days: "M,W,F", startTime: "11:15", endTime: "12:05" },

  // IR
  { courseCode: "CAS IR 230", semester: "Fall 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS IR 230", semester: "Spring 2027", days: "M,W,F", startTime: "10:10", endTime: "11:00" },
  { courseCode: "CAS IR 271", semester: "Fall 2027", days: "T,R", startTime: "12:20", endTime: "13:35" },
  { courseCode: "CAS IR 395", semester: "Spring 2028", days: "T,R", startTime: "14:00", endTime: "15:15" },
  { courseCode: "CAS IR 499", semester: "Spring 2029", days: "T,R", startTime: "15:30", endTime: "16:45" },
];

// ── Seed function ────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Hub areas...");
  for (const area of HUB_AREAS) {
    await prisma.hubArea.upsert({
      where: { code: area.code },
      update: { name: area.name, capacity: area.capacity, unitsRequired: area.unitsRequired },
      create: { code: area.code, name: area.name, capacity: area.capacity, unitsRequired: area.unitsRequired },
    });
  }
  console.log(`Seeded ${HUB_AREAS.length} Hub areas`);

  console.log("Seeding courses...");
  for (const course of COURSES) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: { title: course.title, credits: course.credits, department: course.department, slug: course.slug },
      create: { code: course.code, title: course.title, credits: course.credits, department: course.department, slug: course.slug },
    });
  }
  console.log(`Seeded ${COURSES.length} courses`);

  console.log("Seeding user progress...");
  for (const prog of USER_PROGRESS) {
    const course = await prisma.course.findUnique({ where: { code: prog.code } });
    if (!course) { console.warn(`Course ${prog.code} not found, skipping progress`); continue; }
    await prisma.userCourseProgress.upsert({
      where: { courseId_userId: { courseId: course.id, userId: "" } },
      update: { status: prog.status, semester: prog.semester, grade: prog.grade },
      create: { userId: "", courseId: course.id, status: prog.status, semester: prog.semester, grade: prog.grade },
    });
  }
  console.log(`Seeded ${USER_PROGRESS.length} progress entries`);

  console.log("Seeding Hub-to-Course mappings...");
  let hubMappingCount = 0;
  for (const mapping of HUB_MAPPINGS) {
    const course = await prisma.course.findUnique({ where: { code: mapping.courseCode } });
    if (!course) { console.warn(`Course ${mapping.courseCode} not found for hub mapping`); continue; }
    for (const hubCode of mapping.hubCodes) {
      const hubArea = await prisma.hubArea.findUnique({ where: { code: hubCode } });
      if (!hubArea) { console.warn(`Hub area ${hubCode} not found`); continue; }
      await prisma.courseHubArea.upsert({
        where: { courseId_hubAreaId: { courseId: course.id, hubAreaId: hubArea.id } },
        update: {},
        create: { courseId: course.id, hubAreaId: hubArea.id },
      });
      hubMappingCount++;
    }
  }
  console.log(`Seeded ${hubMappingCount} hub mappings`);

  console.log("Seeding prerequisites...");
  let prereqCount = 0;
  for (const prereq of PREREQUISITES) {
    const course = await prisma.course.findUnique({ where: { code: prereq.course } });
    const prereqCourse = await prisma.course.findUnique({ where: { code: prereq.prereq } });
    if (!course || !prereqCourse) {
      console.warn(`Prereq pair ${prereq.course} -> ${prereq.prereq} not found, skipping`);
      continue;
    }
    await prisma.coursePrerequisite.upsert({
      where: { courseId_prerequisiteId: { courseId: course.id, prerequisiteId: prereqCourse.id } },
      update: { groupId: prereq.groupId, groupType: prereq.groupType },
      create: { courseId: course.id, prerequisiteId: prereqCourse.id, groupId: prereq.groupId, groupType: prereq.groupType },
    });
    prereqCount++;
  }
  console.log(`Seeded ${prereqCount} prerequisites`);

  console.log("Seeding course schedules...");
  let schedCount = 0;
  for (const sched of SCHEDULES) {
    const course = await prisma.course.findUnique({ where: { code: sched.courseCode } });
    if (!course) { console.warn(`Course ${sched.courseCode} not found for schedule`); continue; }
    // Avoid duplicates by checking existing
    const existing = await prisma.courseSchedule.findFirst({
      where: { courseId: course.id, semester: sched.semester, days: sched.days, startTime: sched.startTime },
    });
    if (!existing) {
      await prisma.courseSchedule.create({
        data: {
          courseId: course.id,
          semester: sched.semester,
          days: sched.days,
          startTime: sched.startTime,
          endTime: sched.endTime,
        },
      });
      schedCount++;
    }
  }
  console.log(`Seeded ${schedCount} course schedules`);

  console.log("Seeding programs...");
  for (const prog of PROGRAMS) {
    const program = await prisma.program.upsert({
      where: { code: prog.code },
      update: { name: prog.name, type: prog.type, description: prog.description, isActive: prog.isActive },
      create: { code: prog.code, name: prog.name, type: prog.type, description: prog.description, isActive: prog.isActive },
    });

    // Clear old requirements to avoid duplicates on re-seed
    await prisma.programRequirement.deleteMany({ where: { programId: program.id } });

    for (const req of prog.requirements) {
      const requirement = await prisma.programRequirement.create({
        data: {
          programId: program.id,
          groupName: req.groupName,
          description: req.description,
          minCourses: req.minCourses,
        },
      });

      for (const course of req.courses) {
        await prisma.programRequirementCourse.create({
          data: {
            requirementId: requirement.id,
            courseCode: course.code,
            isRequired: course.isRequired,
          },
        });
      }
    }
  }
  console.log(`Seeded ${PROGRAMS.length} programs`);

  console.log("Assigning programs to test user...");
  for (const progCode of USER_PROGRAMS) {
    const program = await prisma.program.findUnique({ where: { code: progCode } });
    if (!program) { console.warn(`Program ${progCode} not found for user assignment`); continue; }
    await prisma.userProgram.upsert({
      where: { userId_programId: { userId: "", programId: program.id } },
      update: {},
      create: { userId: "", programId: program.id },
    });
  }
  console.log(`Assigned ${USER_PROGRAMS.length} programs to test user`);

  // Ensure a UserProfile exists for the test user
  await prisma.userProfile.upsert({
    where: { id: "" },
    update: { endSemester: "Spring 2029" },
    create: { id: "", email: "test@bu.edu", displayName: "Test User", startSemester: "Fall 2025", endSemester: "Spring 2029", onboardingDone: true },
  });
  console.log("Ensured test user profile exists");

  console.log("Seed complete!");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
