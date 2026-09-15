import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeRMP } from "@/lib/scraper/scrape-rmp";

export const maxDuration = 300; // allow up to 5 minutes on Vercel

async function handleScrape(request: NextRequest) {
  // Verify cron secret when called via Vercel Cron (GET)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scrapeRMP(prisma);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RMP scrape failed" },
      { status: 500 }
    );
  }
}

// GET is used by Vercel Cron
export async function GET(request: NextRequest) {
  return handleScrape(request);
}

// POST for manual triggers
export async function POST(request: NextRequest) {
  return handleScrape(request);
}
