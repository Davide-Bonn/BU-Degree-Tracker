import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

export async function GET() {
  const programs = await prisma.program.findMany({
    select: { id: true, code: true, name: true, type: true, isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(programs);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, isActive } = body;

  if (typeof id !== "number" || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const userId = await getEffectiveUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Add or remove the per-user program selection — never touch the global Program.isActive
  if (isActive) {
    await prisma.userProgram.upsert({
      where: { userId_programId: { userId, programId: id } },
      create: { userId, programId: id },
      update: {},
    });
  } else {
    await prisma.userProgram.deleteMany({
      where: { userId, programId: id },
    });
  }

  return NextResponse.json({ id, isActive });
}
