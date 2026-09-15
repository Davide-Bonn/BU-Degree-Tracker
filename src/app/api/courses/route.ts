import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const hubArea = searchParams.get("hubArea") || "";
  const status = searchParams.get("status") || "";
  const level = searchParams.get("level") || "";

  const courses = await prisma.course.findMany({
    include: {
      hubAreas: { include: { hubArea: true } },
      userProgress: { where: { userId } },
      prerequisiteLinks: {
        include: { prerequisite: { include: { userProgress: { where: { userId } } } } },
      },
    },
    orderBy: { code: "asc" },
  });

  let filtered = courses;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }

  if (hubArea) {
    filtered = filtered.filter((c) =>
      c.hubAreas.some((ha) => ha.hubArea.code === hubArea)
    );
  }

  if (status) {
    filtered = filtered.filter((c) => {
      const progress = c.userProgress[0];
      if (status === "not-started") return !progress;
      return progress?.status === status;
    });
  }

  if (level) {
    filtered = filtered.filter((c) => {
      const num = parseInt(c.code.replace(/\D/g, ""), 10);
      if (level === "100") return num >= 100 && num < 200;
      if (level === "200") return num >= 200 && num < 300;
      if (level === "300") return num >= 300 && num < 400;
      if (level === "400") return num >= 400 && num < 500;
      if (level === "500") return num >= 500;
      return true;
    });
  }

  return NextResponse.json(filtered);
}
