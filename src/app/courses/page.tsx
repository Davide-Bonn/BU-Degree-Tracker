import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { getEffectiveUserId } from "@/lib/user";
import CourseFilters from "./CourseFilters";
import AddToPlannerButton from "./AddToPlannerButton";
import CoursesTour from "./CoursesTour";

const SEASONS = ["Fall", "Spring", "Summer"] as const;
type Season = (typeof SEASONS)[number];

const PAGE_SIZE = 50;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    hubArea?: string;
    status?: string;
    level?: string;
    department?: string;
    school?: string;
    semester?: string;
    season?: string;
    career?: string;
    catalogNumber?: string;
    days?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    instructionMode?: string;
    instructorLastName?: string;
    units?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search || "";
  const selectedHubAreas = (params.hubArea || "").split(",").filter(Boolean);
  const status = params.status || "";
  const level = params.level || "";
  const department = params.department || "";
  const school = params.school || "";
  const semester = params.semester || "";
  const season = params.season || "";
  const career = params.career || "";
  const catalogNumber = params.catalogNumber || "";
  const days = params.days || "";
  const selectedDays = days.split(",").filter(Boolean);
  const startTime = params.startTime || "";
  const endTime = params.endTime || "";
  const location = params.location || "";
  const instructionMode = params.instructionMode || "";
  const instructorLastName = params.instructorLastName || "";
  const units = params.units || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const userId = await getEffectiveUserId();

  // Build DB-level WHERE clause — filter in Postgres, not in JS
  const where: Prisma.CourseWhereInput = {};

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }
  if (department) where.department = department;
  if (school) where.school = school;
  if (career) where.career = career;
  if (catalogNumber) where.code = { contains: catalogNumber, mode: "insensitive" };
  if (units) {
    const target = parseFloat(units);
    if (!Number.isNaN(target)) where.credits = target;
  }

  // Hub area filter: course must satisfy ALL selected hub areas
  if (selectedHubAreas.length > 0) {
    where.AND = selectedHubAreas.map((code) => ({
      hubAreas: { some: { hubArea: { code } } },
    }));
  }

  // Status filter (scoped to current user)
  if (status === "not-started") {
    where.userProgress = { none: { userId } };
  } else if (status) {
    where.userProgress = { some: { userId, status } };
  }

  // Schedule-level filters (all merged into one `some: {}` to require the same section)
  const scheduleFilter: Prisma.CourseScheduleWhereInput = {};
  if (semester) scheduleFilter.semester = semester;
  else if (season && SEASONS.includes(season as Season)) scheduleFilter.semester = { startsWith: season };
  if (location) scheduleFilter.location = location;
  if (instructionMode) scheduleFilter.instructionMode = instructionMode;
  if (instructorLastName) scheduleFilter.instructorLastName = { contains: instructorLastName, mode: "insensitive" };
  if (startTime) scheduleFilter.startTime = { gte: startTime };
  if (endTime) scheduleFilter.endTime = { lte: endTime };
  if (Object.keys(scheduleFilter).length > 0) {
    where.schedules = { some: scheduleFilter };
  }

  // Fetch everything in parallel: count + paginated page + filter dropdown data
  const [totalCount, paginatedCourses, hubAreas, deptGroups, schoolGroups, semGroups, locGroups] =
    await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: {
          hubAreas: { include: { hubArea: true } },
          userProgress: { where: { userId } },
          schedules: true,
          prerequisiteLinks: {
            include: { prerequisite: { include: { userProgress: { where: { userId } } } } },
          },
        },
        orderBy: { code: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.hubArea.findMany({ orderBy: { code: "asc" } }),
      prisma.course.groupBy({
        by: ["department"],
        where: { department: { not: "" } },
        orderBy: { department: "asc" },
      }),
      prisma.course.groupBy({
        by: ["school"],
        where: { school: { not: "" } },
        orderBy: { school: "asc" },
      }),
      prisma.courseSchedule.groupBy({
        by: ["semester"],
        where: { semester: { not: "" } },
      }),
      prisma.courseSchedule.groupBy({
        by: ["location"],
        where: { location: { not: "" } },
        orderBy: { location: "asc" },
      }),
    ]);

  const allDepartments = deptGroups.map((d) => d.department).filter(Boolean) as string[];
  const allSchools = schoolGroups.map((s) => s.school).filter(Boolean) as string[];
  const allScheduleSemesters = semGroups
    .map((s) => s.semester)
    .filter(Boolean)
    .sort((a, b) => {
      const parseDate = (s: string) => {
        const [term, year] = s.split(" ");
        return parseInt(year) * 10 + (term === "Spring" ? 0 : term === "Summer" ? 1 : 2);
      };
      return parseDate(a) - parseDate(b);
    }) as string[];
  const allLocations = locGroups.map((l) => l.location).filter(Boolean) as string[];

  // Apply remaining JS-side filters on the already-paginated 50 results
  // (level and days can't be efficiently expressed in Prisma without raw SQL)
  let courses = paginatedCourses;

  if (level) {
    courses = courses.filter((c) => {
      const num = parseInt(c.code.replace(/\D/g, ""), 10);
      if (level === "100") return num >= 100 && num < 200;
      if (level === "200") return num >= 200 && num < 300;
      if (level === "300+") return num >= 300;
      return true;
    });
  }

  if (selectedDays.length) {
    courses = courses.filter((c) =>
      c.schedules.some((s) => {
        const scheduleDays = s.days.split(",").map((d) => d.trim()).filter(Boolean);
        return selectedDays.every((d) => scheduleDays.includes(d));
      })
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const statusColors: Record<string, string> = {
    completed: "bg-success-light text-success",
    "in-progress": "bg-warning-light text-warning",
    planned: "bg-info-light text-info",
    "not-started": "bg-gray-100 text-muted",
  };

  function buildPageUrl(p: number) {
    const sp = new URLSearchParams(params as Record<string, string>);
    if (p === 1) {
      sp.delete("page");
    } else {
      sp.set("page", String(p));
    }
    const qs = sp.toString();
    return qs ? `/courses?${qs}` : "/courses";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <CoursesTour />
      <h1 className="text-2xl font-bold">Course Browser</h1>

      <div data-tour="course-filters">
        <CourseFilters
          hubAreas={hubAreas.map((h) => ({
            code: h.code,
            name: h.name,
            capacity: h.capacity,
          }))}
          departments={allDepartments}
          schools={allSchools}
          semesters={allScheduleSemesters}
          locations={allLocations}
        />
      </div>

      <div className="text-sm text-muted">
        {totalCount} courses
        {totalPages > 1 && (
          <span className="ml-2">
            — page {page} of {totalPages}
          </span>
        )}
      </div>

      <div data-tour="course-grid" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map((course, idx) => {
          const progress = course.userProgress[0];
          const statusLabel = progress?.status || "not-started";
          const grade = progress?.grade || "";
          const progressSemester = progress?.semester || "";

          const offeredSeasons = [
            ...new Set(
              course.schedules
                .map((s) => s.semester.split(" ")[0])
                .filter((t) => SEASONS.includes(t as Season))
            ),
          ] as Season[];

          const offeredModes = [
            ...new Set(
              course.schedules
                .map((s) => s.instructionMode)
                .filter(Boolean)
            ),
          ] as string[];

          let prereqsMet = true;
          if (course.prerequisiteLinks.length > 0) {
            const groups = new Map<number, typeof course.prerequisiteLinks>();
            for (const link of course.prerequisiteLinks) {
              const g = groups.get(link.groupId) || [];
              g.push(link);
              groups.set(link.groupId, g);
            }
            for (const [, groupLinks] of groups) {
              if (groupLinks[0].groupType === "AND") {
                for (const l of groupLinks) {
                  if (l.prerequisite.userProgress[0]?.status !== "completed") {
                    prereqsMet = false;
                    break;
                  }
                }
              } else {
                const any = groupLinks.some(
                  (l) => l.prerequisite.userProgress[0]?.status === "completed"
                );
                if (!any) prereqsMet = false;
              }
              if (!prereqsMet) break;
            }
          }

          return (
            <div
              key={course.id}
              {...(idx === 0 ? { "data-tour": "course-first-card" } : {})}
              className="bg-card border border-card-border rounded-lg p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm">{course.code}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  {grade && statusLabel === "completed" && (
                    <span className="text-xs font-medium text-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                      {grade}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[statusLabel]}`}
                  >
                    {statusLabel}
                  </span>
                  <AddToPlannerButton
                    courseId={course.id}
                    initialStatus={progress?.status ?? null}
                  />
                </div>
              </div>

              <Link href={`/courses/${course.slug}`} className="block group mb-2">
                <p className="text-sm text-foreground group-hover:text-accent transition-colors">
                  {course.title}
                </p>
                {progressSemester && (
                  <p className="text-xs text-muted mt-0.5">{progressSemester}</p>
                )}
              </Link>

              {course.hubAreas.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {course.hubAreas.map((ha) => (
                    <span
                      key={ha.hubAreaId}
                      className="text-[10px] bg-info-light text-info px-1.5 py-0.5 rounded"
                    >
                      {ha.hubArea.code} · {ha.hubArea.name}
                    </span>
                  ))}
                </div>
              )}

              {(offeredSeasons.length > 0 || offeredModes.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {offeredSeasons.map((s) => (
                    <span
                      key={s}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        s === "Fall"
                          ? "bg-orange-50 text-orange-700"
                          : s === "Spring"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                  {offeredModes.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{course.credits} credits</span>
                {course.department && (
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                    {course.department}
                  </span>
                )}
                {course.prerequisiteLinks.length > 0 && (
                  <span className={prereqsMet ? "text-success" : "text-accent"}>
                    {prereqsMet ? "Prereqs met" : "Prereqs needed"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1)}
              className="px-3 py-1.5 text-sm border border-card-border rounded-md bg-card hover:border-accent/50 transition-colors"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1)}
              className="px-3 py-1.5 text-sm border border-card-border rounded-md bg-card hover:border-accent/50 transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
