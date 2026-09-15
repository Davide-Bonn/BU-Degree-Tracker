import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function getEffectiveUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;
  const cookieStore = await cookies();
  return cookieStore.get("bu-guest-id")?.value ?? "";
}
