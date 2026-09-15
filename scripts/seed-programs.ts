/**
 * Seed all BU undergraduate majors, joint majors, and minors.
 * Run with: npx tsx scripts/seed-programs.ts
 *
 * This is ADDITIVE — existing programs (with matching codes) are updated,
 * new ones are created. No data is deleted.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ProgramSeed {
  code: string;
  name: string;
  type: "major" | "minor" | "joint-major";
  description?: string;
}

// ─── MAJORS ───────────────────────────────────────────────────────────────────

const MAJORS: ProgramSeed[] = [
  // CAS — College of Arts & Sciences
  { code: "cas-anthropology-ba",       name: "Anthropology BA",                    type: "major" },
  { code: "cas-archaeology-ba",        name: "Archaeology BA",                     type: "major" },
  { code: "cas-astronomy-ba",          name: "Astronomy & Astrophysics BA",        type: "major" },
  { code: "cas-biochemistry-bs",       name: "Biochemistry & Molecular Biology BS",type: "major" },
  { code: "cas-biology-ba",            name: "Biology BA",                         type: "major" },
  { code: "cas-biology-bs",            name: "Biology BS",                         type: "major" },
  { code: "cas-chemistry-ba",          name: "Chemistry BA",                       type: "major" },
  { code: "cas-chemistry-bs",          name: "Chemistry BS",                       type: "major" },
  { code: "cas-classical-studies-ba",  name: "Classical Studies BA",               type: "major" },
  { code: "cas-cognitive-neuro-bs",    name: "Cognitive Neuroscience BS",          type: "major" },
  { code: "cs-ba",                     name: "Computer Science BA",                type: "major" },
  { code: "cas-cs-bs",                 name: "Computer Science BS",                type: "major" },
  { code: "cas-earth-env-sci-bs",      name: "Earth & Environmental Sciences BS",  type: "major" },
  { code: "cas-economics-ba",          name: "Economics BA",                       type: "major" },
  { code: "cas-english-ba",            name: "English BA",                         type: "major" },
  { code: "cas-env-analysis-ba",       name: "Environmental Analysis & Policy BA", type: "major" },
  { code: "cas-env-science-bs",        name: "Environmental Science BS",           type: "major" },
  { code: "cas-film-tv-ba",            name: "Film & Television BA",               type: "major" },
  { code: "cas-french-ba",             name: "French & Francophone Studies BA",    type: "major" },
  { code: "cas-geography-ba",          name: "Geography & Environment BA",         type: "major" },
  { code: "cas-german-ba",             name: "German BA",                          type: "major" },
  { code: "cas-history-ba",            name: "History BA",                         type: "major" },
  { code: "cas-art-history-ba",        name: "History of Art & Architecture BA",   type: "major" },
  { code: "cas-italian-ba",            name: "Italian BA",                         type: "major" },
  { code: "cas-linguistics-ba",        name: "Linguistics BA",                     type: "major" },
  { code: "cas-marine-science-bs",     name: "Marine Science BS",                  type: "major" },
  { code: "cas-math-ba",               name: "Mathematics BA",                     type: "major" },
  { code: "cas-math-bs",               name: "Mathematics BS",                     type: "major" },
  { code: "cas-math-stats-ba",         name: "Mathematics & Statistics BA",        type: "major" },
  { code: "cas-music-ba",              name: "Music BA",                           type: "major" },
  { code: "cas-neuroscience-ba",       name: "Neuroscience BA",                    type: "major" },
  { code: "cas-philosophy-ba",         name: "Philosophy BA",                      type: "major" },
  { code: "cas-physics-ba",            name: "Physics BA",                         type: "major" },
  { code: "cas-physics-bs",            name: "Physics BS",                         type: "major" },
  { code: "cas-pols-ba",               name: "Political Science BA",               type: "major" },
  { code: "cas-psychology-ba",         name: "Psychology BA",                      type: "major" },
  { code: "cas-psychology-bs",         name: "Psychology BS",                      type: "major" },
  { code: "cas-religion-ba",           name: "Religion BA",                        type: "major" },
  { code: "cas-sociology-ba",          name: "Sociology BA",                       type: "major" },
  { code: "cas-spanish-ba",            name: "Spanish BA",                         type: "major" },
  { code: "cas-stats-ba",              name: "Statistics BA",                      type: "major" },
  { code: "cas-stats-bs",              name: "Statistics BS",                      type: "major" },
  { code: "cas-theatre-ba",            name: "Theatre Arts BA",                    type: "major" },
  { code: "cas-wgs-ba",                name: "Women's, Gender & Sexuality Studies BA", type: "major" },
  { code: "cas-intl-relations-ba",     name: "International Relations BA",         type: "major" },
  { code: "cas-african-american-ba",   name: "African American Studies BA",        type: "major" },
  { code: "cas-comparative-lit-ba",    name: "Comparative Literature BA",          type: "major" },
  { code: "cas-american-studies-ba",   name: "American Studies BA",                type: "major" },
  { code: "cas-east-asian-studies-ba", name: "East Asian Studies BA",              type: "major" },
  { code: "cas-slavic-ba",             name: "Slavic & East European Studies BA",  type: "major" },

  // CFA — College of Fine Arts
  { code: "cfa-music-performance-bm",  name: "Music Performance BM",              type: "major" },
  { code: "cfa-music-composition-bm",  name: "Music Composition BM",              type: "major" },
  { code: "cfa-music-education-bm",    name: "Music Education BM",                type: "major" },
  { code: "cfa-music-theory-bm",       name: "Music Theory BM",                   type: "major" },
  { code: "cfa-theatre-bfa",           name: "Theatre Arts BFA",                  type: "major" },
  { code: "cfa-musical-theatre-bm",    name: "Musical Theatre BM",                type: "major" },
  { code: "cfa-visual-arts-bfa",       name: "Visual Arts BFA",                   type: "major" },
  { code: "cfa-art-education-bs",      name: "Art Education BS",                  type: "major" },

  // ENG — College of Engineering
  { code: "eng-bme-bs",                name: "Biomedical Engineering BS",          type: "major" },
  { code: "eng-ce-bs",                 name: "Computer Engineering BS",            type: "major" },
  { code: "eng-ece-bs",                name: "Electrical & Computer Engineering BS", type: "major" },
  { code: "eng-me-bs",                 name: "Mechanical Engineering BS",          type: "major" },
  { code: "eng-se-bs",                 name: "Systems Engineering BS",             type: "major" },
  { code: "eng-mse-bs",                name: "Materials Science & Engineering BS", type: "major" },

  // QST — Questrom School of Business
  { code: "qst-business-bs",           name: "Business Administration BS",         type: "major" },

  // COM — College of Communication
  { code: "com-advertising-bs",        name: "Advertising BS",                     type: "major" },
  { code: "com-film-tv-bs",            name: "Film & Television BS",               type: "major" },
  { code: "com-journalism-bs",         name: "Journalism BS",                      type: "major" },
  { code: "com-public-relations-bs",   name: "Public Relations BS",                type: "major" },
  { code: "com-mass-comm-bs",          name: "Mass Communication BS",              type: "major" },

  // SAR — Sargent College of Health & Rehabilitation Sciences
  { code: "sar-athletic-training-bs",  name: "Athletic Training BS",               type: "major" },
  { code: "sar-exercise-physio-bs",    name: "Exercise Physiology BS",             type: "major" },
  { code: "sar-health-science-bs",     name: "Health Science BS",                  type: "major" },
  { code: "sar-human-physio-bs",       name: "Human Physiology BS",                type: "major" },
  { code: "sar-nutrition-bs",          name: "Nutrition BS",                       type: "major" },
  { code: "sar-speech-lang-bs",        name: "Speech, Language & Hearing Sciences BS", type: "major" },

  // SHA — School of Hospitality Administration
  { code: "sha-hospitality-bs",        name: "Hospitality Administration BS",      type: "major" },

  // SPH — School of Public Health
  { code: "sph-public-health-bs",      name: "Public Health BS",                   type: "major" },

  // SSW — School of Social Work
  { code: "ssw-social-work-bs",        name: "Social Work BS",                     type: "major" },

  // CDS — Faculty of Computing & Data Sciences
  { code: "cds-data-science-bs",       name: "Data Science BS",                    type: "major" },

  // Wheelock — College of Education & Human Development
  { code: "wheelock-early-ed-bs",      name: "Early Childhood Education BS",       type: "major" },
  { code: "wheelock-edu-hd-bs",        name: "Education & Human Development BS",   type: "major" },
  { code: "wheelock-elementary-bs",    name: "Elementary Education BS",            type: "major" },
  { code: "wheelock-secondary-bs",     name: "Secondary Education BS",             type: "major" },
  { code: "wheelock-special-ed-bs",    name: "Special Education BS",               type: "major" },
  { code: "wheelock-deaf-ed-bs",       name: "Deaf Studies BS",                    type: "major" },
];

// ─── JOINT MAJORS ─────────────────────────────────────────────────────────────

const JOINT_MAJORS: ProgramSeed[] = [
  { code: "joint-cs-economics",        name: "CS & Economics Joint Major",         type: "joint-major" },
  { code: "joint-cs-math",             name: "CS & Mathematics Joint Major",       type: "joint-major" },
  { code: "joint-cs-linguistics",      name: "CS & Linguistics Joint Major",       type: "joint-major" },
  { code: "joint-cs-music",            name: "CS & Music Joint Major",             type: "joint-major" },
  { code: "joint-math-economics",      name: "Math & Economics Joint Major",       type: "joint-major" },
  { code: "joint-math-philosophy",     name: "Math & Philosophy Joint Major",      type: "joint-major" },
  { code: "joint-math-stats",          name: "Math & Statistics Joint Major",      type: "joint-major" },
  { code: "joint-physics-math",        name: "Physics & Mathematics Joint Major",  type: "joint-major" },
  { code: "joint-qst-business",        name: "Business Administration (QST)",      type: "joint-major" },
  { code: "joint-history-pols",        name: "History & Political Science Joint Major", type: "joint-major" },
  { code: "joint-neuro-psych",         name: "Neuroscience & Psychology Joint Major", type: "joint-major" },
];

// ─── MINORS ───────────────────────────────────────────────────────────────────

const MINORS: ProgramSeed[] = [
  // Arts & Sciences
  { code: "minor-accounting",          name: "Accounting Minor",                   type: "minor" },
  { code: "minor-advertising",         name: "Advertising Minor",                  type: "minor" },
  { code: "minor-african-studies",     name: "African Studies Minor",              type: "minor" },
  { code: "minor-american-studies",    name: "American Studies Minor",             type: "minor" },
  { code: "minor-anthropology",        name: "Anthropology Minor",                 type: "minor" },
  { code: "minor-applied-math",        name: "Applied Mathematics Minor",          type: "minor" },
  { code: "minor-archaeology",         name: "Archaeology Minor",                  type: "minor" },
  { code: "minor-art-history",         name: "Art History Minor",                  type: "minor" },
  { code: "minor-astronomy",           name: "Astronomy Minor",                    type: "minor" },
  { code: "minor-biology",             name: "Biology Minor",                      type: "minor" },
  { code: "minor-business",            name: "Business Minor",                     type: "minor" },
  { code: "minor-chemistry",           name: "Chemistry Minor",                    type: "minor" },
  { code: "minor-chinese",             name: "Chinese Studies Minor",              type: "minor" },
  { code: "minor-cinema-studies",      name: "Cinema Studies Minor",               type: "minor" },
  { code: "minor-classical-studies",   name: "Classical Studies Minor",            type: "minor" },
  { code: "minor-communication",       name: "Communication Minor",                type: "minor" },
  { code: "minor-comp-sci",            name: "Computer Science Minor",             type: "minor" },
  { code: "minor-creative-writing",    name: "Creative Writing Minor",             type: "minor" },
  { code: "minor-criminal-justice",    name: "Criminal Justice Minor",             type: "minor" },
  { code: "minor-data-science",        name: "Data Science Minor",                 type: "minor" },
  { code: "minor-east-asian",          name: "East Asian Studies Minor",           type: "minor" },
  { code: "minor-economics",           name: "Economics Minor",                    type: "minor" },
  { code: "minor-education",           name: "Education Minor",                    type: "minor" },
  { code: "minor-english",             name: "English Minor",                      type: "minor" },
  { code: "minor-env-analysis",        name: "Environmental Analysis Minor",       type: "minor" },
  { code: "minor-env-science",         name: "Environmental Science Minor",        type: "minor" },
  { code: "minor-film-studies",        name: "Film Studies Minor",                 type: "minor" },
  { code: "minor-finance",             name: "Finance Minor",                      type: "minor" },
  { code: "minor-french",              name: "French Minor",                       type: "minor" },
  { code: "minor-geography",           name: "Geography Minor",                    type: "minor" },
  { code: "minor-german",              name: "German Minor",                       type: "minor" },
  { code: "minor-history",             name: "History Minor",                      type: "minor" },
  { code: "minor-hospitality",         name: "Hospitality Minor",                  type: "minor" },
  { code: "minor-human-physio",        name: "Human Physiology Minor",             type: "minor" },
  { code: "minor-information-systems", name: "Information Systems Minor",          type: "minor" },
  { code: "minor-innovation",          name: "Innovation & Entrepreneurship Minor",type: "minor" },
  { code: "minor-italian",             name: "Italian Minor",                      type: "minor" },
  { code: "minor-japanese",            name: "Japanese Studies Minor",             type: "minor" },
  { code: "minor-journalism",          name: "Journalism Minor",                   type: "minor" },
  { code: "minor-judaic-studies",      name: "Judaic Studies Minor",               type: "minor" },
  { code: "minor-latin",               name: "Latin Minor",                        type: "minor" },
  { code: "minor-law",                 name: "Law Minor",                          type: "minor" },
  { code: "minor-linguistics",         name: "Linguistics Minor",                  type: "minor" },
  { code: "minor-management",          name: "Management Minor",                   type: "minor" },
  { code: "minor-marine-science",      name: "Marine Science Minor",               type: "minor" },
  { code: "minor-marketing",           name: "Marketing Minor",                    type: "minor" },
  { code: "minor-math",                name: "Mathematics Minor",                  type: "minor" },
  { code: "minor-music",               name: "Music Minor",                        type: "minor" },
  { code: "minor-neuroscience",        name: "Neuroscience Minor",                 type: "minor" },
  { code: "minor-nutrition",           name: "Nutrition Minor",                    type: "minor" },
  { code: "minor-philosophy",          name: "Philosophy Minor",                   type: "minor" },
  { code: "minor-physics",             name: "Physics Minor",                      type: "minor" },
  { code: "minor-pols",                name: "Political Science Minor",            type: "minor" },
  { code: "minor-psychology",          name: "Psychology Minor",                   type: "minor" },
  { code: "minor-public-health",       name: "Public Health Minor",                type: "minor" },
  { code: "minor-public-relations",    name: "Public Relations Minor",             type: "minor" },
  { code: "minor-religion",            name: "Religion Minor",                     type: "minor" },
  { code: "minor-russian",             name: "Russian Minor",                      type: "minor" },
  { code: "minor-sociology",           name: "Sociology Minor",                    type: "minor" },
  { code: "minor-spanish",             name: "Spanish Minor",                      type: "minor" },
  { code: "minor-stats",               name: "Statistics Minor",                   type: "minor" },
  { code: "minor-sustainability",      name: "Sustainability Minor",               type: "minor" },
  { code: "minor-theatre",             name: "Theatre Arts Minor",                 type: "minor" },
  { code: "minor-urban-studies",       name: "Urban Studies Minor",                type: "minor" },
  { code: "minor-wgs",                 name: "Women's & Gender Studies Minor",     type: "minor" },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const all: ProgramSeed[] = [...MAJORS, ...JOINT_MAJORS, ...MINORS];

  let created = 0;
  let updated = 0;

  for (const prog of all) {
    const existing = await prisma.program.findUnique({ where: { code: prog.code } });
    if (existing) {
      await prisma.program.update({
        where: { code: prog.code },
        data: { name: prog.name, type: prog.type },
      });
      updated++;
    } else {
      await prisma.program.create({
        data: {
          code: prog.code,
          name: prog.name,
          type: prog.type,
          description: prog.description ?? "",
          isActive: false,
        },
      });
      created++;
    }
  }

  const total = await prisma.program.count();
  console.log(`Done. Created: ${created}, Updated: ${updated}, Total in DB: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
