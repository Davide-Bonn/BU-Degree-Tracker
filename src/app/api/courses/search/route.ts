import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      credits: true,
      slug: true,
      userProgress: {
        where: { userId },
        select: { status: true, semester: true, grade: true },
      },
      hubAreas: {
        select: { hubArea: { select: { code: true, name: true } } },
      },
      prerequisiteLinks: {
        select: {
          prerequisite: { select: { code: true } },
          groupId: true,
          groupType: true,
        },
      },
      schedules: { select: { semester: true, days: true, startTime: true, endTime: true } },
    },
    take: 20,
    orderBy: { code: "asc" },
  });

  return NextResponse.json(
    courses.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      credits: c.credits,
      slug: c.slug,
      status: c.userProgress[0]?.status ?? null,
      semester: c.userProgress[0]?.semester ?? null,
      grade: c.userProgress[0]?.grade ?? null,
      hubAreas: c.hubAreas.map((ha) => ({
        code: ha.hubArea.code,
        name: ha.hubArea.name,
      })),
      prereqs: c.prerequisiteLinks.map((p) => ({
        code: p.prerequisite.code,
        groupId: p.groupId,
        groupType: p.groupType,
      })),
      offeredTerms: [...new Set(c.schedules.map((s) => s.semester.split(" ")[0]))],
      sections: (() => {
        const seen = new Set<string>();
        return c.schedules
          .filter((s) => s.days && s.startTime && s.endTime)
          .map((s) => ({
            term: s.semester.split(" ")[0],
            days: s.days,
            startTime: s.startTime,
            endTime: s.endTime,
          }))
          .filter((s) => {
            const k = `${s.term}|${s.days}|${s.startTime}|${s.endTime}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
      })(),
    }))
  );
}
