import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  // scope: 'local' clears the session cookie without an API round-trip
  // (avoids hanging on the Supabase auth endpoint)
  await supabase.auth.signOut({ scope: "local" });
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(new URL("/auth/login", origin));
  response.cookies.set("bu-returning", "true", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
