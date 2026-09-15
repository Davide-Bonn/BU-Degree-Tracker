import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const cookieStore = await cookies();
  const isGuest = !user && !!cookieStore.get("bu-guest-id")?.value;

  // Load available programs for selection
  const programs = await prisma.program.findMany({
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12"
         style={{ backgroundImage: "radial-gradient(ellipse at 60% 20%, var(--accent-light) 0%, transparent 60%)" }}>
      <OnboardingClient
        userEmail={user?.email ?? ""}
        programs={programs}
        isGuest={isGuest}
      />
    </div>
  );
}
