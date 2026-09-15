import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      const cookieStore = await cookies();
      const guestId = cookieStore.get("bu-guest-id")?.value;
      const guestOnboarded = cookieStore.get("bu-guest-onboarded")?.value === "true";
      let skipOnboarding = user?.user_metadata?.onboarding_done === true;

      if (user && guestId?.startsWith("guest-")) {
        // Migrate guest data to the real user account
        await prisma.userCourseProgress.updateMany({
          where: { userId: guestId },
          data: { userId: user.id },
        });
        await prisma.userProgram.updateMany({
          where: { userId: guestId },
          data: { userId: user.id },
        });
        if (guestOnboarded) {
          await supabase.auth.updateUser({ data: { onboarding_done: true } });
          skipOnboarding = true;
        }
      }

      const response = NextResponse.redirect(
        new URL(skipOnboarding ? next : "/onboarding", origin)
      );

      if (guestId) {
        response.cookies.delete("bu-guest-id");
        response.cookies.delete("bu-guest-onboarded");
      }
      response.cookies.set("bu-returning", "true", {
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        path: "/",
      });

      return response;
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=auth_callback_failed", origin));
}
