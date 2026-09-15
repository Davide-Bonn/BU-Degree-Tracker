import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 3000;

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api/");

  // Fast path: no session cookie means definitely not logged in.
  // Skip the network call entirely — instant redirect or pass-through.
  const hasSessionCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasSessionCookie) {
    if (isAuthRoute || isApiRoute) return NextResponse.next({ request });

    const guestId = request.cookies.get("bu-guest-id")?.value;
    const isReturning = request.cookies.get("bu-returning")?.value === "true";

    if (guestId) {
      // returning guest
      const guestOnboarded = request.cookies.get("bu-guest-onboarded")?.value === "true";
      if (!guestOnboarded && pathname !== "/onboarding") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
      return NextResponse.next({ request });
    }

    if (isReturning) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // brand new visitor — assign guest ID
    const newGuestId = `guest-${crypto.randomUUID()}`;
    const res = NextResponse.redirect(new URL("/onboarding", request.url));
    res.cookies.set("bu-guest-id", newGuestId, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/" });
    return res;
  }

  // Session cookie present — build the Supabase client for this request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (() => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
          return (url: RequestInfo | URL, options: RequestInit = {}) =>
            fetch(url, { ...options, signal: controller.signal });
        })(),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Try server-side validation; fall back to local JWT parse if unreachable
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase auth unreachable — parse the JWT from the cookie locally
    const { data: sessionData } = await supabase.auth.getSession();
    user = sessionData.session?.user ?? null;
  }

  if (isAuthRoute) {
    if (user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
      const onboardingDone = user.user_metadata?.onboarding_done === true;
      return NextResponse.redirect(
        new URL(onboardingDone ? "/" : "/onboarding", request.url)
      );
    }
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const onboardingDone = user.user_metadata?.onboarding_done === true;
  if (!onboardingDone && pathname !== "/onboarding" && !isApiRoute) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (onboardingDone && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
