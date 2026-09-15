import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "University Tracker",
  description: "Track your university degree progress - courses, Hub requirements, and more",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get user for sidebar display (null on auth/onboarding pages)
  const supabase = await createClient();
  let user = null;
  try {
    const { data } = await supabase.auth.getSession();
    user = data.session?.user ?? null;
  } catch {
    // Session unavailable — render with no user info
  }

  const userInfo = user
    ? {
        email: user.email ?? "",
        displayName: (user.user_metadata?.display_name as string | undefined) ?? "",
      }
    : null;

  const cookieStore = await cookies();
  const isGuest = !user && !!cookieStore.get("bu-guest-id")?.value;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=new URLSearchParams(window.location.search),u=p.get('theme'),t=u||localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}if(u)localStorage.setItem('theme',u);}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full flex">
        <NextTopLoader color="var(--accent)" showSpinner={false} height={3} />
        <Sidebar user={userInfo} isGuest={isGuest} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
