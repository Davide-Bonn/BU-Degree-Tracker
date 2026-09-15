import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeAllCourses } from "@/lib/scraper/orchestrator";

export async function POST() {
  try {
    await scrapeAllCourses(prisma);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
