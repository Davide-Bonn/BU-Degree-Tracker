import { prisma } from "./prisma";

export interface PrereqNode {
  courseId: number;
  code: string;
  title: string;
  status: "completed" | "in-progress" | "planned" | "not-started";
  children: PrereqNode[];
}

export interface CanTakeResult {
  canTake: boolean;
  missingPrereqs: { code: string; title: string }[];
  completedPrereqs: { code: string; title: string }[];
}

/**
 * Check if a user can take a specific course based on prerequisites.
 */
export async function canTakeCourse(courseId: number): Promise<CanTakeResult> {
  const prereqs = await prisma.coursePrerequisite.findMany({
    where: { courseId },
    include: {
      prerequisite: {
        include: { userProgress: true },
      },
    },
  });

  if (prereqs.length === 0) {
    return { canTake: true, missingPrereqs: [], completedPrereqs: [] };
  }

  // Group by groupId
  const groups = new Map<number, typeof prereqs>();
  for (const p of prereqs) {
    const group = groups.get(p.groupId) || [];
    group.push(p);
    groups.set(p.groupId, group);
  }

  const missingPrereqs: { code: string; title: string }[] = [];
  const completedPrereqs: { code: string; title: string }[] = [];
  let canTake = true;

  for (const [, groupPrereqs] of groups) {
    const groupType = groupPrereqs[0].groupType; // "AND" or "OR"
    const statuses = groupPrereqs.map((p) => {
      const progress = p.prerequisite.userProgress[0];
      const isCompleted = progress?.status === "completed";
      return {
        code: p.prerequisite.code,
        title: p.prerequisite.title,
        completed: isCompleted,
      };
    });

    if (groupType === "AND") {
      // All must be completed
      for (const s of statuses) {
        if (s.completed) {
          completedPrereqs.push({ code: s.code, title: s.title });
        } else {
          missingPrereqs.push({ code: s.code, title: s.title });
          canTake = false;
        }
      }
    } else {
      // OR: at least one must be completed
      const anyCompleted = statuses.some((s) => s.completed);
      if (anyCompleted) {
        for (const s of statuses) {
          if (s.completed) {
            completedPrereqs.push({ code: s.code, title: s.title });
          }
        }
      } else {
        for (const s of statuses) {
          missingPrereqs.push({ code: s.code, title: s.title });
        }
        canTake = false;
      }
    }
  }

  return { canTake, missingPrereqs, completedPrereqs };
}

/**
 * Build a prerequisite tree for visualization.
 */
export async function getPrereqTree(courseId: number, visited = new Set<number>()): Promise<PrereqNode | null> {
  if (visited.has(courseId)) return null;
  visited.add(courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      userProgress: true,
      prerequisiteLinks: {
        include: { prerequisite: { include: { userProgress: true } } },
      },
    },
  });

  if (!course) return null;

  const VALID_STATUSES = ["completed", "in-progress", "planned"] as const;
  type ValidStatus = typeof VALID_STATUSES[number];

  const progress = course.userProgress[0];
  const rawStatus = progress?.status;
  const status: PrereqNode["status"] = rawStatus && (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as ValidStatus
    : "not-started";

  const children: PrereqNode[] = [];
  for (const link of course.prerequisiteLinks) {
    const childNode = await getPrereqTree(link.prerequisiteId, visited);
    if (childNode) children.push(childNode);
  }

  return {
    courseId: course.id,
    code: course.code,
    title: course.title,
    status,
    children,
  };
}

/**
 * Get all courses the user can currently take (all prereqs met).
 */
export async function getAvailableCourses(): Promise<
  { id: number; code: string; title: string; credits: number }[]
> {
  const allCourses = await prisma.course.findMany({
    include: {
      userProgress: true,
      prerequisiteLinks: {
        include: { prerequisite: { include: { userProgress: true } } },
      },
    },
  });

  const available: { id: number; code: string; title: string; credits: number }[] = [];

  for (const course of allCourses) {
    // Skip already completed or in-progress
    const progress = course.userProgress[0];
    if (progress && (progress.status === "completed" || progress.status === "in-progress")) {
      continue;
    }

    // Check if all prereqs are met
    if (course.prerequisiteLinks.length === 0) {
      available.push({ id: course.id, code: course.code, title: course.title, credits: course.credits });
      continue;
    }

    // Group prereqs
    const groups = new Map<number, typeof course.prerequisiteLinks>();
    for (const link of course.prerequisiteLinks) {
      const group = groups.get(link.groupId) || [];
      group.push(link);
      groups.set(link.groupId, group);
    }

    let allMet = true;
    for (const [, groupLinks] of groups) {
      const type = groupLinks[0].groupType;
      if (type === "AND") {
        for (const link of groupLinks) {
          const prereqProgress = link.prerequisite.userProgress[0];
          if (!prereqProgress || prereqProgress.status !== "completed") {
            allMet = false;
            break;
          }
        }
      } else {
        const anyCompleted = groupLinks.some((link) => {
          const prereqProgress = link.prerequisite.userProgress[0];
          return prereqProgress?.status === "completed";
        });
        if (!anyCompleted) allMet = false;
      }
      if (!allMet) break;
    }

    if (allMet) {
      available.push({ id: course.id, code: course.code, title: course.title, credits: course.credits });
    }
  }

  return available;
}
