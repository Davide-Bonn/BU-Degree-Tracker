import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/user";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const guestId = cookieStore.get("bu-guest-id")?.value;

  // Must have either a real user or a guest ID
  const isGuest = !user && !!guestId;
  // Use getEffectiveUserId so the userId matches what the rest of the app
  // (plans page, progress, plan generator) resolves via getSession()
  const userId = await getEffectiveUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { displayName, startSemester, endSemester, programIds } = body as {
    displayName: string;
    startSemester: string;
    endSemester: string;
    programIds: number[];
  };

  // Save profile to local Prisma DB (real users only — guests have no profile row)
  if (!isGuest) {
    await prisma.userProfile.upsert({
      where: { id: userId },
      update: {
        email: user!.email ?? "",
        displayName: displayName ?? "",
        startSemester: startSemester ?? "",
        endSemester: endSemester ?? "",
        onboardingDone: true,
      },
      create: {
        id: userId,
        email: user!.email ?? "",
        displayName: displayName ?? "",
        startSemester: startSemester ?? "",
        endSemester: endSemester ?? "",
        onboardingDone: true,
      },
    });
  }

  // Save selected programs (works for both real users and guests)
  if (Array.isArray(programIds) && programIds.length > 0) {
    // Verify program IDs exist
    const validPrograms = await prisma.program.findMany({
      where: { id: { in: programIds } },
      select: { id: true },
    });
    const validIds = validPrograms.map((p) => p.id);

    // Remove old selections, add new ones
    await prisma.userProgram.deleteMany({ where: { userId } });
    await prisma.userProgram.createMany({
      data: validIds.map((programId) => ({ userId, programId })),
    });

    // isActive is now tracked per-user via UserProgram — no global Program.isActive update needed
  }

  let legacyCount = 0;
  if (!isGuest) {
    // Claim any legacy records (userId = "") as this user's, so existing data isn't lost
    // Safe to do because the first person to sign up is the app owner
    legacyCount = await prisma.$transaction(async (tx) => {
      const count = await tx.userCourseProgress.count({ where: { userId: "" } });
      if (count > 0) {
        await tx.userCourseProgress.updateMany({
          where: { userId: "" },
          data: { userId },
        });
      }
      return count;
    });

    // Store display name and completion flag in Supabase user metadata so proxy.ts can read it
    await supabase.auth.updateUser({
      data: {
        onboarding_done: true,
        display_name: displayName,
      },
    });
  }

  const response = NextResponse.json({ success: true, migratedLegacyRecords: legacyCount });

  if (isGuest) {
    response.cookies.set("bu-guest-onboarded", "true", {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}
