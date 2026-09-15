import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

async function ownScenario(userId: string, id: number) {
  return prisma.planScenario.findFirst({ where: { id, userId } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  if (!await ownScenario(userId, scenarioId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const updated = await prisma.planScenario.update({
    where: { id: scenarioId },
    data: { name: name.trim() },
    select: { id: true, name: true },
  });

  return NextResponse.json(updated);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  if (!await ownScenario(userId, scenarioId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.favourited !== "boolean") {
    return NextResponse.json({ error: "favourited must be boolean" }, { status: 400 });
  }

  const updated = await prisma.planScenario.update({
    where: { id: scenarioId },
    data: { favourited: body.favourited },
    select: { id: true, favourited: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getEffectiveUserId();
  const { id } = await params;
  const scenarioId = parseInt(id, 10);

  if (!await ownScenario(userId, scenarioId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.planScenario.delete({ where: { id: scenarioId } });
  return NextResponse.json({ success: true });
}
