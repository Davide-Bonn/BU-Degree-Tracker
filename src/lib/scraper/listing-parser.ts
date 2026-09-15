import * as cheerio from "cheerio";

const BASE_URL = "https://www.bu.edu";

/**
 * All BU schools/colleges that publish courses in the Bulletin.
 * slug  → URL path segment (/academics/{slug}/courses/)
 * label → Human-readable name
 */
export const SCHOOLS = [
  { slug: "cas",      label: "College of Arts & Sciences" },
  { slug: "cds",      label: "Faculty of Computing & Data Sciences" },
  { slug: "com",      label: "College of Communication" },
  { slug: "eng",      label: "College of Engineering" },
  { slug: "qst",      label: "Questrom School of Business" },
  { slug: "sar",      label: "Sargent College" },
  { slug: "sha",      label: "School of Hospitality Administration" },
  { slug: "sph",      label: "School of Public Health" },
  { slug: "ssw",      label: "School of Social Work" },
  { slug: "sth",      label: "School of Theology" },
  { slug: "met",      label: "Metropolitan College" },
  { slug: "cfa",      label: "College of Fine Arts" },
  { slug: "cgs",      label: "College of General Studies" },
  { slug: "wheelock", label: "Wheelock College of Education & Human Development" },
  { slug: "law",      label: "School of Law" },
  { slug: "grs",      label: "Graduate School of Arts & Sciences" },
] as const;

export type SchoolSlug = (typeof SCHOOLS)[number]["slug"];

/** Returns the courses index URL for a given school slug. */
export function getSchoolUrl(schoolSlug: string): string {
  return `${BASE_URL}/academics/${schoolSlug}/courses/`;
}

// Kept for backward-compat — single-school shortcuts
export const DEPARTMENTS_URL = getSchoolUrl("cas");
export const LISTING_URL = `${BASE_URL}/academics/cas/courses/computer-science/`;

export interface Department {
  name: string;
  url: string;
}

export interface CourseListItem {
  code: string;  // e.g. "CAS CS 111", "QST SM 131", "COM CM 217"
  title: string;
  slug: string;  // e.g. "cas-cs-111"
  url: string;   // full URL to detail page
}

export interface ListingPageResult {
  courses: CourseListItem[];
  nextPageUrl: string | null;
}

/**
 * Parses any BU school courses index page to extract the department list.
 * Primary: div.course-filter > ul > li > ul > li > a
 * Fallback: any <a> whose href contains /courses/ and isn't the "All Departments" link.
 */
export function parseDepartmentList(html: string): Department[] {
  const $ = cheerio.load(html);
  const departments: Department[] = [];
  const seen = new Set<string>();

  // Primary selector
  $("div.course-filter ul ul li a").each((_, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr("href");
    if (!href || name === "All Departments" || seen.has(href)) return;
    seen.add(href);
    departments.push({
      name,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
    });
  });

  // Fallback: look for department links anywhere on page when primary yields nothing
  if (departments.length === 0) {
    $("a[href*='/courses/']").each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      // Department links end in a non-numeric slug, not a course slug
      if (!name || name === "All Departments" || seen.has(href)) return;
      if (/\/courses\/[a-z]+-[a-z]+-\d/i.test(href)) return; // skip course links
      if (!href.match(/\/courses\/[a-z]/i)) return;
      seen.add(href);
      departments.push({
        name,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      });
    });
  }

  return departments;
}

/**
 * Parses a course listing page and returns the courses found plus the next
 * page URL for pagination (null if on the last page).
 *
 * Handles any BU school — course code regex matches:
 *   "CAS CS 131", "QST SM 131", "COM CM 217", "WED AP 500", "LAW AM 700", …
 *   Also handles suffixes like "A1", "L2": "CAS CS 365L", "MET CS 248 A1"
 */
export function parseListingPage(html: string): ListingPageResult {
  const $ = cheerio.load(html);
  const courses: CourseListItem[] = [];

  // Primary selector; fall back to any <li> containing an anchor with a course-style link
  const liEls = $("ul.course-feed li").length
    ? $("ul.course-feed li")
    : $("li").filter((_, el) => {
        const href = $(el).find("a").first().attr("href") || "";
        return href.includes("/courses/");
      });

  liEls.each((_, el) => {
    const linkEl = $(el).find("a").first();
    const href = linkEl.attr("href");
    const text = linkEl.text().trim();
    if (!href || !text) return;

    // Matches school + department + course number with optional alphanumeric suffix
    // e.g. "CAS CS 131", "QST SM 131E", "MET CS 248 A1", "LAW AM 700", …
    const match = text.match(/^([A-Z]{2,8}\s+[A-Z0-9]{1,6}\s+\d+[A-Z0-9]*):\s*(.+)$/i);
    if (!match) return;

    // Normalise code: collapse extra whitespace, uppercase
    const code = match[1].trim().replace(/\s+/g, " ").toUpperCase();
    const title = match[2].trim();

    // Slug from href: /academics/{school}/courses/{dept-slug}/{code-slug}/
    // e.g. cas-cs-131, qst-sm-131, com-cm-217e, wheelock-eced-103
    const slugMatch = href.match(/\/courses\/[^/]+\/([a-z0-9]+-[a-z0-9]+-[\da-z0-9]+)\/?$/i);
    const slug = slugMatch
      ? slugMatch[1].toLowerCase()
      : code.toLowerCase().replace(/\s+/g, "-");

    courses.push({
      code,
      title,
      slug,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
    });
  });

  // Next page: <span class="current"> followed by <span><a href="...">
  let nextPageUrl: string | null = null;
  const nextLink = $("div.pagination span.current").next("span").find("a");
  if (nextLink.length) {
    const nextHref = nextLink.attr("href");
    if (nextHref) {
      nextPageUrl = nextHref.startsWith("http") ? nextHref : `${BASE_URL}${nextHref}`;
    }
  }

  return { courses, nextPageUrl };
}
