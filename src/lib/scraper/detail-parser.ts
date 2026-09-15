import * as cheerio from "cheerio";

// Maps CSS class suffixes from BU's HTML to Hub area names
const HUB_CLASS_TO_AREA: Record<string, string> = {};
// We'll match by text content instead, which is more reliable

export interface CourseDetail {
  credits: number;
  description: string;
  prerequisites: string;
  hubAreas: string[];  // e.g. ["Critical Thinking", "Quantitative Reasoning II"]
  schedules: ScheduleEntry[];
}

export interface ScheduleEntry {
  semester: string;
  section: string;
  instructor: string;
  instructorLastName: string;
  instructorFirstName: string;
  location: string;
  instructionMode: string;
  schedule: string;
  days: string;
  startTime: string;
  endTime: string;
  notes: string;
}

function parseScheduleDays(schedule: string): string {
  const match = schedule.match(/^([MmTtWwRrFfSsUu]+)\s+/);
  if (!match) return "";
  const raw = match[1].toUpperCase();
  const days: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "S" && raw[i + 1] === "U") { days.push("Su"); i += 2; }
    else { days.push(raw[i]); i++; }
  }
  return days.join(",");
}

function toHHMM(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return "";
  let h = parseInt(m[1]); const min = m[2]; const p = m[3].toLowerCase();
  if (p === "pm" && h !== 12) h += 12;
  if (p === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function parseScheduleTime(schedule: string): { startTime: string; endTime: string } {
  const m = schedule.match(/\d{1,2}:\d{2}\s*(?:am|pm)-\d{1,2}:\d{2}\s*(?:am|pm)/i);
  if (!m) return { startTime: "", endTime: "" };
  const parts = m[0].split("-");
  return { startTime: toHHMM(parts[0].trim()), endTime: toHHMM(parts[1].trim()) };
}

function deriveInstructionMode(location: string): string {
  if (!location || location === "NO ROOM" || location === "ARR" || location === "TBA") return "";
  const l = location.toLowerCase();
  if (l.includes("online") || l.includes("remote")) return "Online";
  return "In Person";
}

export function parseDetailPage(html: string): CourseDetail {
  const $ = cheerio.load(html);
  const content = $("#course-content");

  // Parse credits from info-box
  let credits = 4; // default
  const unitsText = content.find("#info-box dd").first().text().trim();
  const unitsNum = parseInt(unitsText, 10);
  if (!isNaN(unitsNum)) credits = unitsNum;

  // Parse Hub areas
  const hubAreas: string[] = [];
  content.find("ul.cf-hub-offerings li").each((_, el) => {
    const area = $(el).text().trim();
    if (area) hubAreas.push(area);
  });

  // Parse description and prerequisites from the <p> tag
  const pText = content.find("p").first().text().trim();
  let description = pText;
  let prerequisites = "";

  // Prerequisites appear at the start with various prefixes:
  //   "Prerequisites: ..."
  //   "Undergraduate Prerequisites: ..."
  //   "Graduate Prerequisites: ..."
  //   "Law Prerequisites: ..."
  // Followed by the description after a dash " - " or a sentence boundary ". [Capital]"
  // Some courses have ONLY a prerequisites line with no description following.
  const prefixMatch = pText.match(/^(?:[\w]+\s+)?Prerequisite[s]?:\s*/i);
  if (prefixMatch) {
    const afterColon = pText.substring(prefixMatch[0].length);
    const sepMatch = afterColon.match(/\s+-\s+|\.\s+(?=[A-Z])/);
    if (sepMatch && sepMatch.index !== undefined) {
      const i = sepMatch.index;
      const isDotSep = afterColon[i] === ".";
      prerequisites = afterColon.substring(0, i + (isDotSep ? 1 : 0)).trim();
      description   = afterColon.substring(i + sepMatch[0].length).trim();
    } else {
      // No description follows — the entire text after the colon is the prereq
      prerequisites = afterColon.replace(/\.\s*$/, "").trim();
      description   = "";
    }
  } else if (/^(?:[\w]+\s+)?Prereq/i.test(pText)) {
    // Fallback: find the colon and dash manually
    const colonIdx = pText.indexOf(":");
    const dashIdx  = pText.indexOf(" - ");
    if (colonIdx > 0 && dashIdx > colonIdx) {
      prerequisites = pText.substring(colonIdx + 1, dashIdx).trim();
      description   = pText.substring(dashIdx + 3).trim();
    }
  }

  // Remove trailing "Effective Fall 20XX..." Hub boilerplate from description
  description = description.replace(/\s*Effective\s+(?:Fall|Spring)\s+\d{4}.*$/s, "").trim();

  // Parse schedules
  const schedules: ScheduleEntry[] = [];
  content.find("div.cf-course h4").each((_, h4El) => {
    const semesterText = $(h4El).text().trim();
    // "FALL 2026 Schedule" -> "Fall 2026"
    const semMatch = semesterText.match(/((?:FALL|SPRING|SUMMER)\s+\d{4})/i);
    const semester = semMatch
      ? semMatch[1].charAt(0).toUpperCase() + semMatch[1].slice(1).toLowerCase()
      : semesterText;

    // The table immediately follows the h4
    const table = $(h4El).next("table");
    table.find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return; // skip header row

      const instructor = $(tds[1]).text().trim();
      const location   = $(tds[2]).text().trim();
      const schedule   = $(tds[3]).text().trim();
      const { startTime, endTime } = parseScheduleTime(schedule);
      schedules.push({
        semester,
        section: $(tds[0]).text().trim(),
        instructor,
        instructorLastName: instructor,
        instructorFirstName: "",
        location,
        instructionMode: deriveInstructionMode(location),
        schedule,
        days: parseScheduleDays(schedule),
        startTime,
        endTime,
        notes: $(tds[4]).text().trim(),
      });
    });
  });

  return {
    credits,
    description,
    prerequisites,
    hubAreas,
    schedules,
  };
}
