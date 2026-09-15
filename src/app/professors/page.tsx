import { prisma } from "@/lib/prisma";
import ProfessorsClient from "./ProfessorsClient";
import ProfessorsTour from "./ProfessorsTour";

export default async function ProfessorsPage() {
  const professors = await prisma.professorRating.findMany({
    orderBy: { avgRating: "desc" },
  });

  const departments = [
    ...new Set(professors.map((p) => p.department).filter(Boolean)),
  ].sort() as string[];

  const serialized = professors.map((p) => ({
    id: p.id,
    name: p.name,
    rmpId: p.rmpId,
    avgRating: p.avgRating,
    avgDifficulty: p.avgDifficulty,
    numRatings: p.numRatings,
    wouldTakeAgainPct: p.wouldTakeAgainPct,
    department: p.department,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <ProfessorsTour />
      <div>
        <h1 className="text-2xl font-bold">Professor Rankings</h1>
        <p className="text-sm text-muted mt-1">
          Ratings sourced from RateMyProfessors —{" "}
          {professors.length > 0
            ? `${professors.length} professors on record`
            : "no data yet — run the RMP scraper to populate"}
          .
        </p>
      </div>
      <ProfessorsClient professors={serialized} departments={departments} />
    </div>
  );
}
