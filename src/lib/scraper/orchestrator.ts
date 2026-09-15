import { PrismaClient } from "@prisma/client";
import { fetchWithRetry } from "./fetcher";
import {
  SCHOOLS,
  getSchoolUrl,
  parseDepartmentList,
  parseListingPage,
  type CourseListItem,
} from "./listing-parser";
import { parseDetailPage, type CourseDetail } from "./detail-parser";
import { parsePrerequisites } from "./prereq-parser";

const SCHOOL_TO_CAREER: Record<string, string> = {
  grs: "Graduate", ssw: "Graduate", sth: "Graduate", sph: "Graduate", law: "Law",
};

// Hub area name -> code mapping
const HUB_NAME_TO_CODE: Record<string, string> = {
  "Philosophical Inquiry and Life's Meanings": "PHI1",
  "Aesthetic Exploration": "PHI2",
  "Historical Consciousness": "PHI3",
  "Scientific Inquiry I": "SCI1",
  "Scientific Inquiry II": "SCI2",
  "Social Inquiry I": "SOC1",
  "Social Inquiry II": "SOC2",
  "Quantitative Reasoning I": "QR1",
  "Quantitative Reasoning II": "QR2",
  "The Individual in Community": "DIV1",
  "Global Citizenship and Intercultural Literacy": "DIV2",
  "Ethical Reasoning": "CIV1",
  "First-Year Writing Seminar": "COM1",
  "Writing, Research, and Inquiry": "COM2",
  "Oral and/or Signed Communication": "COM3",
  "Digital/Multimedia Expression": "COM4",
  "Teamwork/Collaboration": "ITK1",
  "Research and Information Literacy": "ITK2",
  "Creativity/Innovation": "ITK3",
  "Critical Thinking": "ITK4",
};

// Suppress unused-variable warning — kept for reference
void HUB_NAME_TO_CODE;

export interface ScrapeOptions {
  /**
   * School slugs to scrape (e.g. ["cas", "com", "eng"]).
   * Omit or pass [] to scrape all schools.
   * Schools with no existing data are always scraped first.
   */
  schools?: string[];
  /**
   * Department URL slugs to limit the scrape within the selected schools
   * (e.g. ["computer-science", "mathematics-statistics"]).
   * Omit to scrape all departments.
   */
  departments?: string[];
}

export async function scrapeAllCourses(
  prisma: PrismaClient,
  options: ScrapeOptions = {}
): Promise<void> {
  // ── Step 0: Determine schools to scrape ────────────────────────────────────
  let schoolList = [...SCHOOLS] as { slug: string; label: string }[];

  if (options.schools && options.schools.length > 0) {
    const filter = new Set(options.schools.map((s) => s.toLowerCase()));
    schoolList = schoolList.filter((s) => filter.has(s.slug));
    if (schoolList.length === 0) {
      console.error(`No schools matched: ${options.schools.join(", ")}`);
      console.error(`Valid slugs: ${SCHOOLS.map((s) => s.slug).join(", ")}`);
      return;
    }
  }

  // Check which schools already have courses in the DB.
  // Courses belong to a school by URL: /academics/{slug}/courses/...
  console.log("Checking which schools already have data in the database...");
  const schoolCounts = new Map<string, number>();
  for (const school of schoolList) {
    const count = await prisma.course.count({
      where: { url: { contains: `/academics/${school.slug}/courses/` } },
    });
    schoolCounts.set(school.slug, count);
    const status = count === 0 ? "no data — will scrape first" : `${count} courses`;
    console.log(`  ${school.slug.padEnd(10)} ${school.label.padEnd(45)} ${status}`);
  }

  // Sort: schools with 0 existing courses come first.
  schoolList.sort((a, b) => {
    const aEmpty = (schoolCounts.get(a.slug) ?? 0) === 0;
    const bEmpty = (schoolCounts.get(b.slug) ?? 0) === 0;
    if (aEmpty && !bEmpty) return -1;
    if (!aEmpty && bEmpty) return 1;
    return 0;
  });

  const emptyCount = schoolList.filter((s) => (schoolCounts.get(s.slug) ?? 0) === 0).length;
  console.log(
    `\nWill scrape ${schoolList.length} school(s) — ${emptyCount} new, ${schoolList.length - emptyCount} updating\n`
  );

  // ── Loop over each school ──────────────────────────────────────────────────
  for (const school of schoolList) {
    const existingCount = schoolCounts.get(school.slug) ?? 0;
    const isNew = existingCount === 0;

    console.log(`${"═".repeat(64)}`);
    console.log(`  ${school.label} (${school.slug})${isNew ? "  [NEW]" : `  [updating ${existingCount} courses]`}`);
    console.log(`${"═".repeat(64)}`);

    // ── Discover departments for this school ─────────────────────────────────
    const schoolUrl = getSchoolUrl(school.slug);
    console.log(`Discovering departments at ${schoolUrl} ...`);
    let depts = parseDepartmentList(await fetchWithRetry(schoolUrl));

    if (options.departments && options.departments.length > 0) {
      const filter = new Set(options.departments.map((d) => d.toLowerCase()));
      depts = depts.filter((d) => {
        const slug = d.url.replace(/\/$/, "").split("/").pop()?.toLowerCase() ?? "";
        return filter.has(slug);
      });
    }

    if (depts.length === 0) {
      console.log(`  No departments found — skipping ${school.slug}.\n`);
      continue;
    }
    console.log(`  Found ${depts.length} department(s)\n`);

    // ── Collect course listings (all departments, all pages) ─────────────────
    const seenCodes = new Set<string>();
    const courseList: CourseListItem[] = [];

    for (const dept of depts) {
      let pageUrl: string | null = dept.url;
      let pageNum = 1;

      while (pageUrl) {
        const html = await fetchWithRetry(pageUrl);
        const { courses, nextPageUrl } = parseListingPage(html);

        let added = 0;
        for (const c of courses) {
          if (!seenCodes.has(c.code)) {
            seenCodes.add(c.code);
            courseList.push(c);
            added++;
          }
        }

        if (courses.length > 0) {
          console.log(`  ${dept.name.padEnd(40)} page ${pageNum}: ${courses.length} courses (${added} new)`);
        }

        pageUrl = nextPageUrl;
        pageNum++;
      }
    }

    console.log(`\n  Total unique courses for ${school.slug}: ${courseList.length}\n`);

    if (courseList.length === 0) {
      console.log(`  Nothing to scrape for ${school.slug}.\n`);
      continue;
    }

    // ── Fetch individual detail pages ────────────────────────────────────────
    console.log(`Fetching course detail pages for ${school.slug}...`);
    const courseDetails: { listing: CourseListItem; detail: CourseDetail }[] = [];

    for (const listing of courseList) {
      process.stdout.write(`  ${listing.code.padEnd(18)} `);
      try {
        const detailHtml = await fetchWithRetry(listing.url);
        const detail = parseDetailPage(detailHtml);
        courseDetails.push({ listing, detail });
        process.stdout.write(
          `${detail.credits}cr  ${detail.hubAreas.length} hub  ${detail.schedules.length} sections\n`
        );
      } catch (err) {
        process.stdout.write(`FAILED: ${err}\n`);
      }
    }

    // ── Save to database ─────────────────────────────────────────────────────
    console.log(`\nSaving ${courseDetails.length} courses to database...`);
    const hubAreas = await prisma.hubArea.findMany();
    const hubAreaByName = new Map(hubAreas.map((a) => [a.name, a]));

    const schoolLabel = school.label;
    const career = SCHOOL_TO_CAREER[school.slug] ?? "Undergraduate";

    for (const { listing, detail } of courseDetails) {
      const deptCode = listing.code.split(/\s+/)[1] ?? "";

      const course = await prisma.course.upsert({
        where: { code: listing.code },
        update: {
          title: listing.title,
          credits: detail.credits,
          department: deptCode,
          school: schoolLabel,
          career,
          description: detail.description,
          prerequisites: detail.prerequisites,
          slug: listing.slug,
          url: listing.url,
        },
        create: {
          code: listing.code,
          title: listing.title,
          credits: detail.credits,
          department: deptCode,
          school: schoolLabel,
          career,
          description: detail.description,
          prerequisites: detail.prerequisites,
          slug: listing.slug,
          url: listing.url,
        },
      });

      // Hub areas: clear and re-create
      await prisma.courseHubArea.deleteMany({ where: { courseId: course.id } });
      for (const areaName of detail.hubAreas) {
        const hubArea = hubAreaByName.get(areaName);
        if (hubArea) {
          await prisma.courseHubArea.create({
            data: { courseId: course.id, hubAreaId: hubArea.id },
          });
        } else {
          console.warn(`    Unknown Hub area: "${areaName}" for ${listing.code}`);
        }
      }

      // Schedules: clear and re-create
      await prisma.courseSchedule.deleteMany({ where: { courseId: course.id } });
      for (const sched of detail.schedules) {
        await prisma.courseSchedule.create({
          data: {
            courseId: course.id,
            semester: sched.semester,
            section: sched.section,
            instructor: sched.instructor,
            instructorLastName: sched.instructorLastName,
            instructorFirstName: sched.instructorFirstName,
            location: sched.location,
            instructionMode: sched.instructionMode,
            schedule: sched.schedule,
            days: sched.days,
            startTime: sched.startTime,
            endTime: sched.endTime,
            notes: sched.notes,
          },
        });
      }
    }

    console.log(`  Done saving ${school.label}.\n`);
  }

  // ── Final step: re-link prerequisites across all courses ───────────────────
  // Runs after all schools so cross-school prereqs (e.g. CAS CS 330 → CAS MA 225)
  // are resolved even if the prereq course was scraped in a different school loop.
  console.log(`${"═".repeat(64)}`);
  console.log("  Linking prerequisites across all courses...");
  console.log(`${"═".repeat(64)}`);

  const allCourses = await prisma.course.findMany();
  const courseByCode = new Map(allCourses.map((c) => [c.code, c]));
  let linkedTotal = 0;

  for (const course of allCourses) {
    if (!course.prerequisites) continue;

    const groups = parsePrerequisites(course.prerequisites);
    await prisma.coursePrerequisite.deleteMany({ where: { courseId: course.id } });

    for (const group of groups) {
      for (const prereqCode of group.courses) {
        const prereqCourse = courseByCode.get(prereqCode);
        if (prereqCourse) {
          try {
            await prisma.coursePrerequisite.create({
              data: {
                courseId: course.id,
                prerequisiteId: prereqCourse.id,
                groupId: group.groupId,
                groupType: group.type,
              },
            });
            linkedTotal++;
          } catch {
            // Ignore duplicate constraint errors
          }
        }
      }
    }
  }

  console.log(`  ${linkedTotal} prerequisite links created.\n`);
  console.log("All schools scraped successfully!");
}
