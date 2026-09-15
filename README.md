<div align="center">

# BU Degree Tracker

**A full-stack academic planning app for Boston University students.**

Track credits, GPA, BU Hub requirements, CS degree progress, and plan your semesters — all in one place.

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma_6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vercel](https://img.shields.io/badge/Deployed_on_Vercel-000?style=for-the-badge&logo=vercel)](https://vercel.com/)

---

</div>

## Demo

[**Watch the demo video**](https://github.com/Davide-Bonn/BU-Degree-Tracker/releases/download/v1.0.0/Demo_video.mp4)

---

## Features

| Feature | Description |
|:---|:---|
| **Dashboard** | Progress rings for credits (128 total), GPA, and Hub completion at a glance |
| **BU Hub Tracker** | All 21 Hub areas across 6 capacities, color-coded with satisfaction status |
| **CS Degree Requirements** | Groups A/B/C/D with per-course completion tracking |
| **Semester Planner** | Drag-and-drop course scheduling with prerequisite violation warnings |
| **Course Browser** | Filter by department, Hub area, or semester across 1000+ courses |
| **RateMyProfessors** | Star ratings, difficulty scores, and student reviews on every course page |
| **Multiple Programs** | Track major, minors, and joint majors simultaneously |
| **Multi-user Auth** | Supabase authentication for per-user progress tracking |
| **PDF Export** | Export your semester plan as a PDF |
| **Manual Hub Overrides** | Mark Hub areas as satisfied for courses not in the database |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A [Supabase](https://supabase.com/) project (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/Davide-Bonn/BU-Degree-Tracker.git
cd BU-Degree-Tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your Supabase credentials from [Settings > API](https://supabase.com/dashboard):

```env
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 3. Database setup

```bash
npx prisma db push        # Push schema to Supabase
npx prisma generate       # Generate Prisma client
```

### 4. Seed data (optional)

```bash
npx tsx prisma/seed.ts              # Course catalog data
npx tsx scripts/seed-programs.ts    # CS BA / minor requirements
```

### 5. Run

```bash
npm run dev
```

Open **http://localhost:3000**

---

## Scripts

| Command | What it does |
|:---|:---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run scrape` | Scrape BU course catalog from Bulletin |
| `npm run scrape:rmp` | Fetch RateMyProfessors ratings for all instructors |
| `npm run refresh` | Full data refresh (scrape + seed) |
| `npm run seed:programs` | Seed CS BA and minor program requirements |
| `npm run tag:labs` | Tag courses with lab components |
| `npm run screenshot` | Capture app screenshots (Playwright) |

> **Windows:** Stop the dev server before running `prisma generate` or `prisma db push` — Node locks `query_engine-windows.dll.node`.

---

## Project Structure

```
prisma/
  schema.prisma           # Database schema (PostgreSQL)
  seed.ts                 # Initial data seeder
scripts/
  scrape.ts               # BU course catalog scraper
  scrape-rmp.ts           # RateMyProfessors batch scraper
  seed-programs.ts        # Program requirements seeder
src/
  app/
    page.tsx              # Dashboard — progress rings
    courses/              # Course browser + detail pages + RMP ratings
    hub/                  # BU Hub requirements (21 areas, 6 capacities)
    degree/               # CS BA degree groups (A/B/C/D)
    planner/              # Drag-and-drop semester planner
    programs/             # Major / minor / joint-major tracking
    professors/           # Professor directory with RMP data
    api/                  # API routes for mutations + scraping
  components/             # Sidebar, theme toggle, tour, skeleton
  lib/
    progress.ts           # getOverallProgress() — central data function
    prerequisites.ts      # Prerequisite checking + tree building
    scraper/              # Course catalog + RMP parsing pipeline
```

---

## Deployment

Deployed on [Vercel](https://vercel.com/):

1. Connect your GitHub repo to Vercel
2. Add environment variables from `.env.example` in the Vercel dashboard
3. Deploy — Vercel runs `prisma generate && next build` automatically

A **weekly cron job** refreshes RateMyProfessors data every Monday at 6 AM UTC.

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| **Framework** | Next.js 16 (App Router, Server Components) |
| **Language** | TypeScript 5 |
| **Frontend** | React 19, Tailwind CSS 4 |
| **Database** | PostgreSQL via Supabase |
| **ORM** | Prisma 6 |
| **Auth** | Supabase Auth |
| **Scraping** | Cheerio (HTML), RMP GraphQL API |
| **Deployment** | Vercel + Cron Jobs |

---

## License

Personal academic project. Not affiliated with Boston University.
